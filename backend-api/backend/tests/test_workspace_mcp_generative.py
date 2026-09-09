from workspace_mcp.server._helpers import (
    normalize_chart_params,
    validate_add_generative_widget_request,
)


def test_note_with_string_data_is_valid():
    assert (
        validate_add_generative_widget_request(
            widget_type="note", data="Greeting", chart_params=None
        )
        is None
    )


def test_html_with_string_data_is_valid():
    assert (
        validate_add_generative_widget_request(
            widget_type="html", data="<p>hi</p>", chart_params=None
        )
        is None
    )


def test_note_with_non_string_data_is_rejected():
    assert (
        validate_add_generative_widget_request(
            widget_type="note", data=[{"x": 1}], chart_params=None
        )
        is not None
    )


def test_table_with_list_data_is_valid():
    assert (
        validate_add_generative_widget_request(
            widget_type="table", data=[{"x": 1}], chart_params=None
        )
        is None
    )


def test_chart_without_params_is_rejected():
    assert (
        validate_add_generative_widget_request(
            widget_type="chart", data=[{"x": 1}], chart_params=None
        )
        is not None
    )


def test_chart_with_valid_params_is_valid():
    assert (
        validate_add_generative_widget_request(
            widget_type="chart",
            data=[{"x": 1, "y": 2}],
            chart_params={"chartType": "line", "xKey": "x", "yKey": ["y"]},
        )
        is None
    )


def test_normalize_chart_params_translates_snake_case_aliases():
    assert normalize_chart_params(
        {
            "chart_type": "bar",
            "x_key": "x",
            "y_key": ["y"],
            "angle_key": "a",
            "callout_label_key": "c",
        }
    ) == {
        "chartType": "bar",
        "xKey": "x",
        "yKey": ["y"],
        "angleKey": "a",
        "calloutLabelKey": "c",
    }


def test_normalize_chart_params_camel_case_wins_over_snake_case():
    assert normalize_chart_params(
        {"chartType": "line", "chart_type": "bar", "xKey": "x", "yKey": ["y"]}
    ) == {"chartType": "line", "xKey": "x", "yKey": ["y"]}


def test_normalize_chart_params_passes_unknown_keys_and_none_through():
    assert normalize_chart_params({"custom": 1, "xKey": "x"}) == {
        "custom": 1,
        "xKey": "x",
    }
    assert normalize_chart_params(None) is None
