from market.kb.stock_faq_kb import STOCK_FAQ_KB
from market.kb.market_analysis_kb import MARKET_ANALYSIS_KB
from market.kb.investing_kb import INVESTING_KB
import re

# your structure is list of dicts so merge with +
ALL_KB = STOCK_FAQ_KB + MARKET_ANALYSIS_KB + INVESTING_KB

def normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)  # remove ? . , etc
    text = re.sub(r"\s+", " ", text)      # collapse spaces
    return text
def stem(word: str) -> str:
    suffixes = ["ing", "tion", "ment", "ness", "ers", "es", "ed", "ly", "s"]
    for suffix in suffixes:
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[:-len(suffix)]
    return word
def search_knowledge_base(user_question: str) -> str | None:
    normalized_question = normalize(user_question)

    for item in ALL_KB:
        normalized_kb_question = normalize(item["question"])

        # 1. Exact match
        if normalized_question == normalized_kb_question:
            return item["answer"]

        # 2. KB question is inside user question
        if normalized_kb_question in normalized_question:
            return item["answer"]

        # 3. User question is inside KB question
        if normalized_question in normalized_kb_question:
            return item["answer"]

    return None

