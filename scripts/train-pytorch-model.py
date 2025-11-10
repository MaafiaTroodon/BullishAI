#!/usr/bin/env python3
"""
PyTorch Model Training Script
Fine-tunes a language model on stock_qa_100k.json using LoRA/QLoRA

Requirements:
- torch
- transformers
- peft
- datasets
- jsonlines

Usage:
    python scripts/train-pytorch-model.py
"""

import json
import os
from pathlib import Path
from typing import List, Dict
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, TaskType
from datasets import Dataset

def load_qa_dataset(jsonl_path: str) -> List[Dict]:
    """Load JSONL dataset"""
    data = []
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                try:
                    data.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return data

def format_prompt(question: str, answer: str) -> str:
    """Format Q&A as training prompt"""
    return f"Question: {question}\nAnswer: {answer}\n\n"

def prepare_dataset(data: List[Dict], tokenizer, max_length: int = 512):
    """Prepare dataset for training"""
    texts = []
    for item in data:
        prompt = format_prompt(item['question'], item['answer'])
        texts.append(prompt)
    
    def tokenize_function(examples):
        return tokenizer(
            examples['text'],
            truncation=True,
            max_length=max_length,
            padding='max_length'
        )
    
    dataset = Dataset.from_dict({'text': texts})
    tokenized = dataset.map(tokenize_function, batched=True)
    return tokenized

def train_model(
    model_name: str = "microsoft/DialoGPT-medium",  # Lightweight base model
    dataset_path: str = "components/stock_qa_100k.json",
    output_dir: str = "models/finetuned-stock-qa",
    epochs: int = 3,
    batch_size: int = 4,
    learning_rate: float = 2e-4,
):
    """Train fine-tuned model"""
    
    print("Loading dataset...")
    data = load_qa_dataset(dataset_path)
    print(f"Loaded {len(data)} examples")
    
    print("Loading tokenizer and model...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype="auto",
        device_map="auto"
    )
    
    # Apply LoRA for efficient fine-tuning
    print("Applying LoRA...")
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=8,
        lora_alpha=16,
        lora_dropout=0.1,
        target_modules=["c_attn", "c_proj"]  # Adjust based on model architecture
    )
    model = get_peft_model(model, lora_config)
    
    # Prepare dataset
    print("Preparing dataset...")
    dataset = prepare_dataset(data, tokenizer)
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        learning_rate=learning_rate,
        logging_steps=100,
        save_steps=1000,
        save_total_limit=3,
        fp16=True,
        gradient_accumulation_steps=4,
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )
    
    # Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        data_collator=data_collator,
    )
    
    # Train
    print("Starting training...")
    trainer.train()
    
    # Save
    print(f"Saving model to {output_dir}...")
    trainer.save_model()
    tokenizer.save_pretrained(output_dir)
    
    print("Training complete!")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="microsoft/DialoGPT-medium")
    parser.add_argument("--dataset", default="components/stock_qa_100k.json")
    parser.add_argument("--output", default="models/finetuned-stock-qa")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--lr", type=float, default=2e-4)
    
    args = parser.parse_args()
    
    train_model(
        model_name=args.model,
        dataset_path=args.dataset,
        output_dir=args.output,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
    )

