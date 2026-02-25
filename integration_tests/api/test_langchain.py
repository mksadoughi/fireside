"""
LangChain integration test against a live Fireside server.

Requires:
    pip install langchain-openai openai

Configure via environment variables (see conftest.py):
    FIRESIDE_URL, FIRESIDE_API_KEY, FIRESIDE_MODEL

Usage:
    FIRESIDE_API_KEY=sk-... pytest integration_tests/api/test_langchain.py -v -s
"""

import pytest
from conftest import BASE_URL, API_KEY, MODEL

pytestmark = pytest.mark.skipif(not API_KEY, reason="FIRESIDE_API_KEY not set")

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    pytest.skip("langchain-openai not installed", allow_module_level=True)


@pytest.fixture
def llm():
    return ChatOpenAI(
        base_url=f"{BASE_URL}/v1",
        api_key=API_KEY,
        model=MODEL,
        temperature=0.7,
    )


@pytest.fixture
def llm_streaming():
    return ChatOpenAI(
        base_url=f"{BASE_URL}/v1",
        api_key=API_KEY,
        model=MODEL,
        temperature=0.7,
        streaming=True,
    )


def test_simple_invoke(llm):
    """Single-message chat returns a non-empty response."""
    response = llm.invoke("Say hello in exactly 3 words.")
    assert response.content, "Response should not be empty"


def test_streaming(llm_streaming):
    """Streaming response arrives in multiple chunks."""
    chunks = []
    for chunk in llm_streaming.stream("Count from 1 to 5."):
        chunks.append(chunk.content)

    assert len(chunks) > 1, "Should receive multiple streamed chunks"
    assert "".join(chunks), "Full response should not be empty"


def test_multi_turn(llm):
    """Model recalls information from earlier in the conversation."""
    from langchain_core.messages import HumanMessage, AIMessage

    messages = [HumanMessage(content="My name is Kazem.")]
    response1 = llm.invoke(messages)
    assert response1.content

    messages.append(AIMessage(content=response1.content))
    messages.append(HumanMessage(content="What is my name?"))
    response2 = llm.invoke(messages)
    assert "kazem" in response2.content.lower(), "Model should remember the name"


def test_list_models():
    """OpenAI client can list models from the Fireside API."""
    import openai

    client = openai.OpenAI(base_url=f"{BASE_URL}/v1", api_key=API_KEY)
    models = client.models.list()
    model_ids = [m.id for m in models.data]

    assert len(model_ids) > 0, "Should have at least one model"
