"""Test manuel du transport HTTP contre un serveur MCP déjà lancé."""

import asyncio

from mcp import Client


async def main() -> None:
    async with Client("http://127.0.0.1:8000/mcp") as client:
        tools = await client.list_tools()
        result = await client.call_tool("list_leagues", {})
        print(
            {
                "tools": [tool.name for tool in tools.tools],
                "league_count": len(result.structured_content["leagues"]),
            }
        )


if __name__ == "__main__":
    asyncio.run(main())

