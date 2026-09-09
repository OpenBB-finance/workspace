"""Generate specification."""

from dataclasses import asdict, dataclass
import os
import json
from pathlib import Path
import re
from typing import Any, Dict, List, Literal, Optional
from dotenv import dotenv_values
from requests import get

_ENV_FILE = ".env.local"

HELP_URL = dotenv_values(_ENV_FILE)["VITE_HELP_URL"]


@dataclass
class Parameter:
    """Parameter."""

    name: str
    description: str
    type_: str
    optional: bool = False
    default: Optional[str | int | bool] = None


@dataclass
class Example:
    "Example."
    description: str
    parameters: dict  # {<name>: <value>, ...}


@dataclass
class Body:
    "Body."
    endpoint: str
    method: Literal["GET"]


@dataclass
class Function:
    "Function."
    name: str
    description: str
    helpUrl: str  # pylint: disable=invalid-name
    parameters: List[Parameter]
    body: Body
    returns: str
    providers: List[str]
    examples: Optional[List[Example]] = None


class SpecGenerator:
    """This class generates a specification from openapi and widgets.json files."""

    prefix = "/api/v1/"
    parent_dir = os.path.join(Path(__file__).parent)

    def __init__(
        self,
        openapi_file: Optional[Path] = None,
        widgets_file: Optional[Path] = None,
        api_endpoints: Optional[List[str]] = None,
    ) -> None:
        self.openapi_file = openapi_file or Path(self.parent_dir, "pre", "openapi.json")
        self.widgets_file = widgets_file or Path(self.parent_dir, "pre", "widgets.json")
        self.openapi = self.read(self.openapi_file)
        self.widgets = self.process_widgets(self.read(self.widgets_file))
        self.api_endpoints = api_endpoints or self.get_api_endpoints()

    @staticmethod
    def read(file: Path) -> dict:
        """Read data from file."""
        try:
            with open(file, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"File {file} not found.\n")
            return {}

    @staticmethod
    def dump(data: Any, file: Path):
        """Dump data to file"""
        with open(file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)

    @staticmethod
    def openapi2ts(type_: str) -> str:
        """Transform openapi type to typescript."""
        match type_:
            case "integer":
                return "number"
            case "array":
                return "any[][]"
            case _:
                return type_

    @classmethod
    def fetch_widgets(cls, github_pat):
        """Fetch widgets.json"""
        branch = "develop"
        base_url = f"https://raw.githubusercontent.com/OpenBB-finance/terminalpro/{branch}/src/lib/widgets.json"
        try:
            widgets = get(
                headers={"Authorization": f"token {github_pat}"},
                url=f"{base_url}",
                timeout=10
            ).json()
            with open(
                Path(cls.parent_dir, "pre", "widgets.json"), "w", encoding="utf-8"
            ) as file:
                json.dump(widgets, file, indent=4)
            print(f"Updated widgets.json from '{base_url}'\n")            
        except Exception:
            print(f"\nFailed to fetch widgets.json from '{base_url}'\n")

    @classmethod
    def fetch_openapi(cls, base_url: str):
        """Fetch openapi.json"""
        try:
            openapi = get(f"{base_url}/openapi.json", timeout=10).json()
            with open(
                Path(cls.parent_dir, "pre", "openapi.json"), "w", encoding="utf-8"
            ) as file:
                json.dump(openapi, file, indent=4)
            print(f"Updated openapi.json from '{base_url}'\n")
        except Exception:  # pylint: disable=broad-exception-caught
            print(f"\nFailed to fetch openapi.json from '{base_url}'\n")

    @staticmethod
    def format_description_multiple(sentence: str, providers: List[str]) -> str:
        """Format descriptions that contain multiple items allowed sentence."""
        pattern = re.compile(
            r"Multiple comma separated items allowed for provider\(s\): ([^.]+)."
        )
        match = re.search(pattern, sentence)
        if match:
            desc_providers = match.group(1).split(", ")
            if all(p in desc_providers for p in providers):
                return sentence.replace(
                    match.group(), "Multiple comma separated items allowed."
                )
            elif any(p in desc_providers for p in providers):
                if len(providers) == 1:
                    return sentence.replace(
                        match.group(), "Multiple comma separated items allowed."
                    )
                return f"Multiple comma separated item allowed for provider(s): {' ,'.join(set(desc_providers).intersection(set(providers)))}"
        return sentence

    @staticmethod
    def split_description_by_provider(description: str) -> dict:
        """Split a description by provider when it is provider specific."""
        pattern = r"([a-zA-Z0-9].*?)(?:\s*\(provider: ([^)]*)\))?(?:;|$)"
        result = re.findall(pattern, description)
        d = {}
        for r in result:
            keys = r[1].replace(" ", "").split(",")
            d.update({k or "_": r[0] for k in keys})
        return d

    @staticmethod
    def split_schema_by_provider(schema: dict) -> dict:
        """Split the schemas by provider."""
        schema_by_provider = {}
        sub_schemas = [s.get("enum", []) for s in schema.get("anyOf", [schema])]
        for i, provider in enumerate(schema.get("title", "").split(",")):
            schema_by_provider[provider] = (
                [s for s in sub_schemas[i] if s is not None]
                if i < len(sub_schemas)
                else []
            )
        return schema_by_provider

    @staticmethod
    def rebuild_description(
        description_by_provider: dict, schema_by_provider: dict, providers: List[str]
    ) -> str:
        """Rebuild the description based on the description by provider."""
        concat_desc: Dict[str, List[str]] = {}

        for p in providers:
            desc = description_by_provider.get(p, "")
            if desc:
                new_desc = desc
                if schema := schema_by_provider.get(p, ""):
                    new_desc = desc.strip(".") + f". Options: {', '.join(schema)}."
                if new_desc not in concat_desc:
                    concat_desc[new_desc] = []
                concat_desc[new_desc].append(p)

        result = ""
        for k, v in concat_desc.items():
            result += f"{k}"
            if len(v) > 1:
                result += f"(provider: {', '.join(v)})"
        return result

    @staticmethod
    def format_parameters(
        providers: List[str], parameters: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Format parameters list."""

        def swap(my_list: list, index1: int, index2: int):
            """Swap list elements"""
            temp = my_list[index1]
            my_list[index1] = my_list[index2]
            my_list[index2] = temp

        def reorder(_parameters: List[Dict[str, Any]]):
            """Swap provider until optional parameters are found"""
            for i, p in enumerate(_parameters):
                if p.get("name") == "provider":
                    if i < len(_parameters) - 1 and "(provider: " not in _parameters[
                        i + 1
                    ].get("description", ""):
                        swap(_parameters, i, i + 1)
                    else:
                        break

        reorder(parameters)

        remove = set()
        for i, p in enumerate(parameters):
            available_providers = p.get("schema", {}).get("title", "").split(",")
            name = p.get("name", "")
            description = p.get("description", "")
            description_by_provider = SpecGenerator.split_description_by_provider(
                description
            )
            schema_by_provider = SpecGenerator.split_schema_by_provider(
                p.get("schema", {})
            )

            if "_" in description_by_provider:
                p["description"] = SpecGenerator.format_description_multiple(
                    sentence=description, providers=providers
                )
            else:
                p["description"] = SpecGenerator.rebuild_description(
                    description_by_provider=description_by_provider,
                    schema_by_provider=schema_by_provider,
                    providers=providers,
                )

            match name:
                case "chart":
                    remove.add(i)
                case "provider":
                    p.get("schema", {})["default"] = providers[0]
                    if len(providers) == 1:
                        p["x-exclude-from-ui"] = True
                    p[
                        "description"
                    ] = f"Options: {', '.join(providers)}, defaults to {providers[0]}."
                    p["required"] = False
                case "sort":
                    p.get("schema", {})["default"] = "desc"
                    p["x-exclude-from-ui"] = True
                case "limit":
                    p.get("schema", {})["default"] = min(
                        p.get("schema", {}).get("default", 500), 500
                    )

            if "(provider: " in description:
                if not any(p in available_providers for p in providers):
                    remove.add(i)

        return [p for i, p in enumerate(parameters) if i not in remove]

    def get_api_endpoints(self) -> List[str]:
        "Get API endpoints from openapi.json."
        paths = set(self.openapi["paths"].keys())
        remove = set(
            {
                "/",  # root path
                "/search/symbols",
                "/udf/search",
                "/udf/symbols",
                "/search/fred",
                "/search/currencies",
            }
        )
        return sorted(
            list(
                filter(lambda x: not x.startswith(f"{self.prefix}pro"), paths - remove)
            )
        )

    def process_widgets(self, widgets: dict) -> dict:
        """Process widgets."""

        def set_providers(f: str, d: dict, providers: List[str]):
            if f not in d:
                d[f] = {"providers": providers}
            else:
                d[f]["providers"].extend(providers)

        d: Dict[str, Dict[str, List[str]]] = {}
        for w in widgets.values():
            funcs = w.get("excelDataFunction", [])
            funcs = [f[4:] if f.startswith("OBB.") else f for f in funcs]
            sources = w.get("source", [])
            if funcs and sources:
                for f in funcs:
                    set_providers(f, d, sources)
        final_d = {k: {i: list(set(j)) for i, j in d[k].items()} for k in sorted(d)}
        return final_d

    def get_providers(self, custom_function: str, details: dict) -> List[str]:
        """Get providers based on function name."""
        if widgets := self.widgets.get(custom_function, {}):
            providers = widgets.get("providers") or []
            # This is a temporary patch, because widgets.json sources field is ambiguous.
            # Sometimes a widget calls 2 endpoint:  2 endpoint -> 2 providers, 1 for each
            # Others a widget uses 2 providers: 1 endpoint -> 2 providers
            # There is no reliable way to tell which endpoint uses which provider
            # We can infer that the first endpoint gets the first provider and so on...
            # but this is not granted in the future.
            # This is the case for the widget 'Revenue Trends'
            if custom_function == "EQUITY.FUNDAMENTAL.HISTORICAL_EPS":
                providers = ["fmp"]
            available_providers: list[str] = []
            for p in details.get("parameters", {}):
                if p.get("name") == "provider":
                    p_schema = p.get("schema", {})
                    available_providers = p_schema.get("enum") or [p_schema.get("const")] or []
            for p in providers:
                if p not in available_providers:
                    raise ValueError(
                        f"Unsupported provider '{p}' found for '{custom_function}' in widgets.json"
                    )
            return providers
        # raise ValueError(f"Provider not found for '{name}' in widgets.json")
        return []

    def get_param_type(self, func_name: str, parameter: dict) -> str:
        """Get parameter type."""
        p_name = parameter.get("name")
        p_in = parameter.get("in", "")
        if p_in == "query":
            p_schema = parameter.get("schema", {})
            if "type" in p_schema:
                p_type = self.openapi2ts(p_schema.get("type", ""))
            elif "enum" in p_schema:
                p_type = "string"
            else:
                p_type_list = [
                    self.openapi2ts(schema.get("type", ""))
                    for schema in p_schema.get("anyOf", [])
                ]
                p_type = " | ".join(sorted(set(p_type_list) - {"null"}))
            p_type = p_type or "any"
            return p_type
        raise ValueError(
            f"{func_name} -> {p_name}: parameter in '{p_in}' not supported yet."
        )

    def get_param_default(self, parameter: dict) -> str:
        """Get parameter default."""
        p_name = parameter.get("name", "")
        p_default = parameter.get("schema", {}).get("default", "")
        if p_default and isinstance(p_default, list):
            return p_default[0]
        if p_default:
            if p_name in ("start_date", "end_date", "date"):
                return ""
            if p_name in ("limit") and p_default > 500:
                return "500"
        return p_default

    def reorder_parameters(
        self, parameters: List[Parameter], previous_parameters: List[str]
    ) -> List[Parameter]:
        """Reorder such that the previous order remains and new parameters come last."""
        current_parameter_names = [p.name for p in parameters]
        previous_parameter_names = [p["name"] for p in previous_parameters]
        order = [
            previous_parameter_names.index(p) if p in previous_parameter_names else -1
            for p in current_parameter_names
        ]
        parameters_with_order = list(zip(parameters, order))
        parameters_with_order.sort(key=lambda x: x[1] if x[1] != -1 else float("inf"))
        reordered_parameters = [param[0] for param in parameters_with_order]
        return reordered_parameters

    def generate(self) -> List[dict]:
        """Translate openapi.json and widgets.json to spec."""

        previous_spec = self.read(Path(self.parent_dir, "spec.json"))
        previous_spec_per_endpoint = {f["body"]["endpoint"]: f for f in previous_spec}

        spec = []
        for e in self.api_endpoints:
            e_details = self.openapi["paths"].get(e)
            if e_details:
                method = list(e_details.keys())[0]
                m_details = e_details.get(method)

                if m_details:
                    path = e.replace(self.prefix, "")

                    custom_function = path.replace("/", ".").upper()
                    if custom_function[0] in (".", "_"):
                        custom_function = custom_function[1:]

                    if not (
                        providers := sorted(
                            self.get_providers(custom_function, m_details)
                        )
                    ):
                        print(f"- Skipping {custom_function}")
                        continue

                    og_parameters = m_details.get("parameters")
                    formatted = self.format_parameters(providers, og_parameters)
                    parameters = [
                        Parameter(
                            name=p["name"],
                            description=p["description"],
                            type_=self.get_param_type(custom_function, p),
                            optional=not p["required"],
                            default=self.get_param_default(p),
                        )
                        for p in formatted
                        if not p.get("x-exclude-from-ui")
                    ]
                    reordered_parameters = self.reorder_parameters(
                        parameters,
                        previous_spec_per_endpoint.get(e, {}).get("parameters", []),
                    )
                    parameter_names = [p.name for p in reordered_parameters]
                    examples = m_details.get("examples", [])
                    filtered_examples = [
                        Example(
                            description=ex.get("provider", ""),
                            parameters={
                                k: v
                                for k, v in ex.get("parameters", {}).items()
                                if k in parameter_names
                            },
                        )
                        for ex in examples
                        if ex.pop("scope") == "api"
                        and isinstance(ex, dict)
                        and ex.get("provider") in providers
                    ]

                    f = Function(
                        name=custom_function,
                        description=m_details.get("description", ""),
                        helpUrl=f"{HELP_URL}/reference/{custom_function.replace('.', '/').lower()}",
                        parameters=reordered_parameters,
                        body=Body(endpoint=e, method="GET"),
                        returns="any[][]",
                        examples=filtered_examples,
                        providers=providers,
                    )
                    spec.append(asdict(f))

        return spec


if __name__ == "__main__":
    spec_gen = SpecGenerator()
    spec_ = spec_gen.generate()
    spec_gen.dump(data=spec_, file=Path(spec_gen.parent_dir, "spec.json"))
