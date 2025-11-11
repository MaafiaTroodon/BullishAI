# AI Training & Inference Setup Guide

This guide explains how to set up the multi-model AI system using Groq Llama 3, Gemini, and PyTorch local models trained on `stock_qa_100k.json`.

## Overview

The system uses three AI models:
1. **Groq Llama 3** - Fast, low-latency responses for quick insights
2. **Google Gemini** - Multimodal analysis for PDFs, filings, tables
3. **Local PyTorch** - Fine-tuned model for domain-specific finance Q&A

## Current Implementation

✅ **Already Working:**
- Groq Llama 3 integration (via `GROQ_API_KEY`)
- Gemini integration (via `GEMINI_API_KEY`)
- Knowledge base search using `stock_qa_100k.json`
- Smart model routing based on query type
- Fallback mechanisms between models

## Setting Up PyTorch Local Model (Optional)

### Step 1: Install Python Dependencies

```bash
pip install torch transformers peft datasets jsonlines fastapi uvicorn
```

### Step 2: Train the Model

```bash
python scripts/train-pytorch-model.py \
  --model microsoft/DialoGPT-medium \
  --dataset components/stock_qa_100k.json \
  --output models/finetuned-stock-qa \
  --epochs 3 \
  --batch-size 4 \
  --lr 2e-4
```

**Note:** Training requires GPU for reasonable speed. CPU training will be very slow.

### Step 3: Start Inference Server

```bash
# Set environment variables
export MODEL_PATH=models/finetuned-stock-qa
export BASE_MODEL=microsoft/DialoGPT-medium

# Start server
python scripts/pytorch-inference-server.py
# Or: uvicorn scripts.pytorch-inference-server:app --host 0.0.0.0 --port 8000
```

### Step 4: Enable in Next.js

Add to your `.env` file:

```env
LOCAL_PYTORCH_ENABLED=true
LOCAL_PYTORCH_URL=http://localhost:8000
```

## How It Works

### 1. Query Processing
- User asks a question in the chat
- System searches `stock_qa_100k.json` for relevant examples
- Detects query intent (Quick Insights, Technical, Recommended, etc.)

### 2. Model Selection
- **Groq Llama 3**: Default for quick insights, real-time queries
- **Gemini**: PDFs, filings, financial statements, tables
- **Local PyTorch**: Domain-specific Q&A, screening, rationale (if enabled)

### 3. Response Generation
- Model receives query + knowledge base examples + real-time market data
- Generates conversational response matching knowledge base style
- Falls back to knowledge base answer if model fails

### 4. Fallback Chain
1. Try selected model (Groq/Gemini/PyTorch)
2. If rate limited → Try alternative model
3. If all fail → Use best knowledge base match

## Knowledge Base Integration

The system uses `stock_qa_100k.json` to:
- Find similar questions/answers as style examples
- Provide fallback answers when models fail
- Enhance prompts with domain-specific context

**Scoring Algorithm:**
- Exact question match: +100 points
- Word matches in question: +5 points each
- Section/tag matches: +10 points each
- Ticker matches: +15 points each

## API Endpoints

### Chat API
```
POST /api/chat
Body: { query: string, symbol?: string }
```

Returns:
```json
{
  "answer": "Response text",
  "model": "groq-llama" | "gemini" | "local-pytorch",
  "modelBadge": "Groq Live" | "Gemini AI" | "PyTorch",
  "latency": 123,
  "section": "Quick Insights",
  "tickers": ["AAPL"]
}
```

### PyTorch Inference Server
```
GET /health
POST /infer
Body: {
  "question": "string",
  "context": "string",
  "max_length": 512,
  "temperature": 0.2,
  "top_k": 50,
  "top_p": 0.9
}
```

## Troubleshooting

### Groq Rate Limits
- System automatically falls back to Gemini
- If both fail, uses knowledge base answer

### PyTorch Server Not Available
- System automatically falls back to Groq
- No errors shown to user

### Knowledge Base Not Loading
- Check file path: `components/stock_qa_100k.json`
- Ensure file is valid JSONL format
- Check server logs for parsing errors

## Performance Tips

1. **Knowledge Base Caching**: Already implemented - loads once, cached in memory
2. **Model Selection**: Smart routing reduces unnecessary API calls
3. **Fallback Chain**: Ensures users always get a response
4. **Response Enhancement**: Uses knowledge base to improve short/generic answers

## Next Steps

1. Train PyTorch model on your dataset (optional)
2. Fine-tune model selection logic based on your use cases
3. Add more knowledge base examples
4. Monitor model performance and adjust routing

## Environment Variables

```env
# Required
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key

# Optional (for PyTorch)
LOCAL_PYTORCH_ENABLED=true
LOCAL_PYTORCH_URL=http://localhost:8000
MODEL_PATH=models/finetuned-stock-qa
BASE_MODEL=microsoft/DialoGPT-medium
```

