# NutriSnap: Health Matrix API Specification

This document defines the internal logic and expected data structures for the Health Matrix AI analysis route.

## Endpoint Overview
**Route:** `POST /api/analyze-meal` (Implemented via Genkit Server Action)
**Purpose:** Accepts user meal descriptions and optional image data, processes them through Gemini 1.5 Flash, and returns structured nutritional data.

---

## 1. The Request Payload

The frontend sends the following payload to the `mealNutritionalAnalysis` flow:

```json
{
  "mealDescription": "Mixed Balanced Meal, looks like 300g",
  "mealPhotoDataUri": "data:image/png;base64,...", // Optional: Base64 encoded image
  "mealTime": "22:11"
}
```

---

## 2. Internal AI Logic Flow

1. **Payload Validation:** Verify that either `mealDescription` or `mealPhotoDataUri` is present.
2. **Prompt Assembly:** Combines the description and image (if present) into a multi-modal prompt.
3. **Strict Formatting:** Demands a JSON output that matches the NutriSnap dashboard schema.

---

## 3. Expected JSON Output Schema

The AI returns this structure to the dashboard:

```json
{
  "calories": 450,
  "protein": 30.0,
  "carbs": 50.0,
  "fat": 15.0,
  "sugar": 10.0,
  "fiber": 5.0,
  "saturatedFat": 4.0,
  "healthInsight": "Great choice! This meal provides a diverse range of nutrients.",
  "foodItems": [
    {
      "name": "Grilled Chicken",
      "grams": 150,
      "calories": 247,
      "protein": 31.0,
      "carbs": 0.0,
      "fat": 12.5,
      "sugar": 0.0
    }
  ]
}
```
