// @ts-expect-error - ignored for now
import type { MockUser } from "./types";

export const SHARED_USERS_STORAGE_KEY = "openbb-app-shared-users";

export const MOCK_USERS: MockUser[] = [
  { name: "Alice Smith", email: "asmith@gmail.com", role: "Analyst" },
  { name: "Bob Jonhson", email: "bjonhson@gmail.com", role: "Analyst" },
  { name: "Sophia Taylor", email: "staylor@gmail.com", role: "Analyst" },
  { name: "David Lee", email: "dlee@gmail.com", role: "Analyst" },
  { name: "John Coulter", email: "jcoulter@gmail.com", role: "Portfolio Specialist" },
  { name: "Emily Davis", email: "edavis@gmail.com", role: "Portfolio Specialist" },
  { name: "Michael Brown", email: "mbrown@gmail.com", role: "Compliance Officer" },
  { name: "Sarah Wilson", email: "swilson@gmail.com", role: "Compliance Officer" },
];

export const MOCK_ROLES = ["Analyst", "Portfolio Specialist", "Compliance Officer"];

export const MOCK_OWNER = {
  name: "Daniel Blomquist",
  email: "dblomquist@gmail.com",
};
