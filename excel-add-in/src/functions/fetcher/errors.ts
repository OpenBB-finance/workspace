import posthog from "posthog-js";
import { VITE_PLATFORM_URL } from "~/constants";
import { useAuthStore } from "~/store/auth";

interface ValidationError {
  input: string | null;
  loc: string[];
  msg: string;
  type: string;
  ctx?: {
    expected: string;
  };
  url?: string;
}

interface ErrorResponse {
  detail: string | ValidationError[];
}

/*
 * @description Takes a message and code and returns a CustomFunctions.Error
 *
 * @param {string} message
 * @param {CustomFunctions.ErrorCode} code
 * @returns {CustomFunctions.Error}
 */
export function CFError(
  message: string,
  code: CustomFunctions.ErrorCode = CustomFunctions.ErrorCode.invalidValue,
): CustomFunctions.Error {
  return new CustomFunctions.Error(code, message);
}

export const throwSignInError = () => {
  Office.addin.showAsTaskpane();
  throw CFError("Sign in with Pro account.");
};

function parseValidationError(detail: string): ValidationError[] {
  // Message needs preprocessing to be valid JSON
  const validJsonString = detail
    .replace(/\(/g, "[")
    .replace(/\)/g, "]")
    .replace(/"([^"]*)"/g, (_: unknown, match: string) => {
      const replaced = match.replace(/'/g, '\\"');
      return `"${replaced}"`;
    })
    .replace(/'/g, '"')
    .replace(/None/g, "null");
  return JSON.parse(validJsonString);
}

/**
 * @description Takes an error response and throws a CustomFunctions.Error with the error messages
 *
 * @param {ErrorResponse} errorResponse
 * @returns {void}
 */
export function handleErrors(
  errorResponse: ErrorResponse,
  status?: number,
  url?: string,
): void {
  if (status === 401 && url?.includes(VITE_PLATFORM_URL)) {
    console.log("🚫 User token is not valid.");
    const { logout } = useAuthStore.getState();
    logout();
    return throwSignInError();
  }

  const errorArray: string[][] = [];
  const { detail } = errorResponse;
  try {
    if (typeof detail === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of detail as any) {
        if (typeof item.msg === "string") {
          const msg = `${item.loc[1]} -> ${item.msg}`;
          errorArray.push([msg]);
        }
      }
    } else if (typeof detail === "string") {
      if (detail.startsWith("[{") && detail.endsWith("}]")) {
        const detailObject = parseValidationError(detail);
        for (let i = 0; i < detailObject.length; i++) {
          const arg =
            detailObject[i].loc.length >= 2
              ? detailObject[i].loc[1] + " -> "
              : "";
          const msg = detailObject[i].msg.replace(/\s+\[.*?\]/, "");
          const full_msg = `${arg}${msg}`;
          errorArray.push([full_msg]);
        }
      } else {
        const detailObject = detail.split("\n");

        if (detailObject.length === 1) {
          errorArray.push([detailObject[0]]);
        } else {
          for (let i = 0; i < detailObject.length; i += 4) {
            const arg = `${detailObject[i + 1]}`;
            const msg = detailObject[i + 2].replace(/\s+\[.*?\]/, "");
            const full_msg = `${arg} -> ${msg}`;
            errorArray.push([full_msg]);
          }
        }
      }
    }
  } catch (error) {
    throw CFError("Failed to fetch data.");
  }
  if (errorArray.length === 0) {
    throw CFError("Failed to fetch data.");
  }
  throw CFError(errorArray.join(";\n"));
}

/**
 * @description Takes an error and returns it as a range
 *
 * @param {Error | CustomFunctions.Error} error
 * @returns {string[][]}
 */
export default function OBBExcelError(
  error: Error | CustomFunctions.Error,
): string[][] {
  // Excel desktop on Mac does not show the error message, so we need to return it as a range
  if (error instanceof CustomFunctions.Error && error.message) {
    posthog.capture("custom_function_error", { error_message: error.message });
    return error.message.split(";\n").map((item: string) => ["#OBB!: " + item]);
  }
  // If the error is not a CustomFunctions.Error, it is unexpected
  // so we log it and throw, this will display #VALUE! in the cell
  // instead of returning a Typescript error in the sheet
  posthog.capture("unexpected_error", { error_message: error.message });
  console.error(error);
  throw error;
}
