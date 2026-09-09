import type { AddResponse } from "utils/requests";

export async function handleRequest(
  response: AddResponse,
  setWarning: (set: string) => void,
  setShow: (set: boolean) => void,
  retrieveItems: () => Promise<void>,
  extraWarning?: string,
): Promise<void> {
  if (!response.success) {
    const warning = extraWarning ? `${extraWarning}: ${response.message}` : response.message;
    setWarning(warning ?? "");
  } else {
    await retrieveItems();
    const warning = extraWarning || "";
    setWarning(warning);
    const timeoutTimer = warning ? 3000 : 500;
    setTimeout(() => {
      setShow(false);
    }, timeoutTimer);
  }
}
