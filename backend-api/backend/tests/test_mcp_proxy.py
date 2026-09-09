import pytest
from pydantic import ValidationError
from routers.pro.index import MCPProxyRequest
from utilities.config import settings


class TestMCPProxyRequest:
    def test_valid_urls(self):
        MCPProxyRequest(url="https://example.com/api", headers={}, body={})
        MCPProxyRequest(url="http://api.internal.com:8080/v1/mcp", headers={}, body={})

    def test_invalid_urls_localhost(self):
        with pytest.raises(ValidationError, match="Invalid URL: localhost is not allowed"):
            MCPProxyRequest(url="http://localhost:8000/api", headers={}, body={})

        with pytest.raises(ValidationError, match="Invalid URL: localhost is not allowed"):
            MCPProxyRequest(url="http://127.0.0.1:8000/api", headers={}, body={})

        with pytest.raises(ValidationError, match="Invalid URL: localhost is not allowed"):
            MCPProxyRequest(url="http://[::1]:8000/api", headers={}, body={})

    def test_invalid_urls_ip(self):
        with pytest.raises(ValidationError, match="Invalid URL: IP addresses are not allowed"):
            MCPProxyRequest(url="http://192.168.1.100/api", headers={}, body={})

        with pytest.raises(ValidationError, match="Invalid URL: IP addresses are not allowed"):
            MCPProxyRequest(url="https://10.0.0.1/api", headers={}, body={})

    def test_allowed_mcp_hostnames(self):
        # Temporarily mock the settings.ALLOWED_MCP_HOSTNAMES
        original_hostnames = settings.ALLOWED_MCP_HOSTNAMES
        settings.ALLOWED_MCP_HOSTNAMES = ["192.168.1.100", "localhost"]
        try:
            # Should not raise exception
            MCPProxyRequest(url="http://192.168.1.100/api", headers={}, body={})
            MCPProxyRequest(url="http://localhost:8000/api", headers={}, body={})
        finally:
            settings.ALLOWED_MCP_HOSTNAMES = original_hostnames
