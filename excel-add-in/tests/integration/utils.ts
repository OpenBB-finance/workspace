import axios from "axios";
import { User } from "~/types/user.types";

export async function getPlatformAccessToken(): Promise<string> {
  try {
    const email = process.env.TEST_PLATFORM_EMAIL;
    const password = process.env.TEST_PLATFORM_PASSWORD;
    if (!email || !password) {
      throw new Error("Email or password environment variables are not set");
    }

    // Send login request
    const backendClient = axios.create({
      baseURL: process.env.VITE_BACKEND_URL,
      headers: {
        "X-OpenBB-Authorization": `Bearer ${process.env.PAYMENTS_AUTH_TOKEN}`,
      },
    });
    console.log("[Fetch] POST", process.env.VITE_BACKEND_URL);
    const { data } = await backendClient.post<User>("/pro/login", {
      email: email,
      password: password,
      remember: false,
      ip_address: "",
      source: "excel",
    });

    if (!data || !data.access_token) {
      throw new Error("Failed to retrieve access token from login response");
    }

    return data.access_token;
  } catch (error) {
    console.error("Setup beforeAll failed:", error);
    throw error;
  }
}

// Jest custom serializer to avoid saving the entire response
export const customSerializer = (length: number = -1) => {
  return {
    test: (value) => Array.isArray(value),
    print: (value) => {
      if (Array.isArray(value)) {
        const truncatedValue = value.slice(0, length);
        return (
          `Result slice [0:${length}]: ` +
          JSON.stringify(truncatedValue, null, 2)
        );
      }
    },
  };
};

export function checkExpected({
  received,
  min_rows = 2, // 1 header + 1 data row
  min_columns = 1,
}: {
  received: any[];
  min_rows?: number;
  min_columns?: number;
}) {
  try {
    expect(received).toBeInstanceOf(Array);
    expect(received.length).toBeGreaterThanOrEqual(min_rows);
    if (received.length > 0)
      expect(received[0].length).toBeGreaterThanOrEqual(min_columns);
    expect(received).toMatchSnapshot();
  } catch (error) {
    console.error(received);
    throw error;
  }
}
