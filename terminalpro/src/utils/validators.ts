import { banned_keywords } from "~/utils/zodForms";
export function validateEmail(email: string): boolean {
  const re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return typeof email === "string" && re.test(email);
}

export function validateFolderName(folderName: string): boolean {
  return (
    folderName &&
    !["root", "New folder"].includes(folderName) &&
    folderName.length <= 20
  );
}

export function dangerousQuery(value: string): null | string {
  const cleanValue = value.toLocaleLowerCase();
  for (const keyword of banned_keywords) {
    if (cleanValue.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}
