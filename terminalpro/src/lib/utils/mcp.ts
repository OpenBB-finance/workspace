export function getServerName(url: string): string {
  try {
    const { hostname, port } = new URL(url);
    return port ? `${hostname}:${port}` : hostname;
  } catch {
    return "MCP Server";
  }
}
