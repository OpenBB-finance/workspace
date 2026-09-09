/* eslint-disable @typescript-eslint/no-explicit-any */

/** 
  * @description Generates a query string from an array of parameter name, value and default value
  * 
  * @param {Array<[string, any, string]>} params
  * @returns {URLSearchParams}
*/ 
export function generateQueryParams(
    params: Array<[string, any, string]>,
  ): string {
    const queryParams = new URLSearchParams();
  
    // Range parameters need to be passed as multiple single query parameters
    // E.g.: countries=abc&countries=def...
    function flattenArray(arr: Array<any>, paramName: string) {
      for (const item of arr) {
        if (Array.isArray(item)) {
          flattenArray(item, paramName);
        } else if (item != null && item !== "") {
          queryParams.append(paramName, item.toString());
        }
      }
    }
  
    for (const [paramName, paramValue, defaultValue] of params) {
      if (Array.isArray(paramValue)) {
        flattenArray(paramValue, paramName);
      } else {
        const valueToUse = paramValue ?? defaultValue;
  
        if (valueToUse != null && valueToUse !== "") {
          queryParams.append(paramName, valueToUse.toString());
        }
      }
    }
  
    return queryParams.toString();
  }