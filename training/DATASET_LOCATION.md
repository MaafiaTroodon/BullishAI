# Dataset Location

## Expected File

The training dataset should be placed at:

```
training/practice_qa_100k.jsonl
```

Or if you prefer to keep it in components (as mentioned):

```
components/practice_qa_100k.jsonl
```

## Current Status

The dataset file does not exist yet. You'll need to:

1. Collect 100k+ question-answer pairs
2. Format them according to `training/dataset_template.jsonl`
3. Place the file in the training directory
4. Run the training script

## Training Command

Once you have the dataset:

```bash
python training/train_lora.py --dataset training/practice_qa_100k.jsonl
```

Or if using components location:

```bash
python training/train_lora.py --dataset components/practice_qa_100k.jsonl
```

## Dataset Format

Each line should be a JSON object with:

- `question`: User question
- `answer`: Model response (with `<PLACEHOLDER>` for numbers)
- `rationale`: Why this answer is correct
- `tickers`: Array of stock symbols mentioned
- `citations`: Array of source citations
- `context_required`: Boolean (true for answers needing live data)
- `risk_note`: Optional risk disclaimer

See `training/dataset_template.jsonl` for examples.

