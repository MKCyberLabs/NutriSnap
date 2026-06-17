# NutriSnap: Health Matrix API Specification

This document defines the internal logic and expected data structures for the Health Matrix AI analysis route.

## Endpoint Overview
**Route:** `POST /api/analyze-meal` (Implemented via Genkit Server Action)
**Purpose:** Accepts user meal descriptions and local image paths, processes them through Gemini 1.5 Flash, and returns structured nutritional data.

---

## 1. The Request Payload

The frontend sends the following lightweight payload to the `mealNutritionalAnalysis` flow. Note that we do NOT send Base64 image data over the network; we only send the path.

```json
{
  "mealDescription": "Mixed Balanced Meal, looks like 300g",
  "imagePath": "/uploads/1718659200_98432.png", // Optional: Path to the shared Docker volume
  "mealTime": "22:11"
}
```

---

## 2. Internal AI Logic Flow

1. **Payload Validation:** Verify that either `mealDescription` or `imagePath` is present.
2. **Local File Reading (Disk IO):** 
   - If `imagePath` is provided, the backend uses Node's `fs` (File System) module to locate the file in the `/public` directory (which is mapped to the Docker volume).
   - The backend reads the file synchronously into a Buffer and converts it into the necessary data URI format required by the Genkit/Gemini SDK.
3. **Prompt Assembly:** Combines the description and the locally read image into a multi-modal prompt.
4. **Strict Formatting:** Demands a JSON output that matches the NutriSnap dashboard schema.

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