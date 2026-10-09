'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  FileText,
  Loader2,
  Sparkles,
  Clock,
  X,
  Check,
  RotateCcw,
  Tag,
  Star,
  Info,
  Flame,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MealCategory } from '@/lib/types';
import { format, parse, isValid } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MealNutritionalAnalysisOutput } from '@/ai/flows/meal-nutritional-analysis';
import { inferMealCategoryFromTime, MEAL_CATEGORY_OPTIONS } from '@/lib/food/meal-category';

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

interface MealAnalysisToolProps {
  category?: MealCategory;
  initialCategory?: MealCategory | 'auto';
  onAnalysisComplete: (
    data: MealNutritionalAnalysisOutput,
    category: MealCategory,
    mealTime: string,
    imagePath?: string
  ) => Promise<void> | void;
  onCancel: () => void;
}

export function MealAnalysisTool({
  category: deprecatedCategory,
  initialCategory = 'auto',
  onAnalysisComplete,
  onCancel,
}: MealAnalysisToolProps) {
  // Support either prop
  const startingMode = deprecatedCategory ? 'manual' : initialCategory === 'auto' ? 'auto' : 'manual';
  const startingCategory: MealCategory = deprecatedCategory || (initialCategory === 'auto' ? 'Lunch' : initialCategory);

  const [categoryMode, setCategoryMode] = useState<'auto' | 'manual'>(startingMode);
  const [manualCategory, setManualCategory] = useState<MealCategory>(startingCategory);

  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImagePath, setUploadedImagePath] = useState<string | undefined>(undefined);

  // Custom Time State (Defaults to current time)
  const [hour12, setHour12] = useState(() => format(new Date(), 'hh'));
  const [minutes, setMinutes] = useState(() => format(new Date(), 'mm'));
  const [period, setPeriod] = useState(() => format(new Date(), 'a'));
  const [mealTime, setMealTime] = useState(() => format(new Date(), 'HH:mm'));

  // Multi-stage flow: 'analyze' -> 'review'
  const [stage, setStage] = useState<'analyze' | 'review'>('analyze');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MealNutritionalAnalysisOutput | null>(null);

  const { toast } = useToast();

  // Dynamically inferred category based on current mealTime
  const inferredCategory = useMemo(() => {
    return inferMealCategoryFromTime(mealTime);
  }, [mealTime]);

  // Final category determined by Auto vs Manual override
  const effectiveCategory: MealCategory = useMemo(() => {
    return categoryMode === 'auto' ? inferredCategory : manualCategory;
  }, [categoryMode, inferredCategory, manualCategory]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Keep mealTime in sync with hour12, minutes, period
  useEffect(() => {
    const timeString = `${hour12}:${minutes} ${period}`;
    const parsedDate = parse(timeString, 'hh:mm a', new Date());
    if (isValid(parsedDate)) {
      setMealTime(format(parsedDate, 'HH:mm'));
    }
  }, [hour12, minutes, period]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      // Reset any previous uploaded path since file changed
      setUploadedImagePath(undefined);
    }
  };

  const clearSelection = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setUploadedImagePath(undefined);
  };

  const handleAnalyze = async () => {
    if (!description.trim() && !selectedFile && !uploadedImagePath) {
      toast({
        variant: "destructive",
        title: "Missing input",
        description: "Please provide a description or upload a photo of your meal.",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      let finalImagePath = uploadedImagePath;

      // 1. Upload photo if a new file was selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Could not save image to local storage.');
        }

        const data = await uploadRes.json();
        finalImagePath = data.url;
        setUploadedImagePath(finalImagePath);
      }

      // 2. Call Health Matrix analysis endpoint
      const res = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealDescription: description.trim() || undefined,
          imagePath: finalImagePath,
          mealTime,
        }),
      });

      const resultData = await res.json();

      if (!res.ok) {
        if (res.status === 400 && resultData.error?.includes('NOT_FOOD')) {
          throw new Error(resultData.error);
        }
        if (res.status >= 500) {
          throw new Error(
            resultData.error ||
            'Meal analysis service is temporarily unavailable. Your meal has not been saved.'
          );
        }
        throw new Error(resultData.error || 'Health Matrix Analysis Failed');
      }

      setAnalysisResult(resultData as MealNutritionalAnalysisOutput);
      // Move to review stage before persistence!
      setStage('review');
    } catch (error: any) {
      console.error("Health Matrix API Error:", error);
      toast({
        variant: "destructive",
        title: "Analysis issue",
        description: error.message || "Meal analysis service is temporarily unavailable. Your meal has not been saved.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveConfirmed = async () => {
    if (!analysisResult) return;
    setIsSaving(true);
    try {
      await onAnalysisComplete(
        analysisResult,
        effectiveCategory,
        mealTime,
        uploadedImagePath
      );
      toast({
        title: "Meal Saved",
        description: `Logged under ${effectiveCategory} (${analysisResult.calories} kcal).`,
      });
    } catch (err: any) {
      console.error("Failed to save meal log:", err);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err.message || "Could not save your meal log.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // STAGE B: REVIEW SCREEN
  // -------------------------------------------------------------
  if (stage === 'review' && analysisResult) {
    return (
      <div className="flex flex-col h-full max-h-[80vh]">
        <div className="flex-1 overflow-y-auto py-2 pr-1 space-y-5">
          {/* Header banner */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs uppercase font-bold tracking-widest text-primary">AI Analysis Ready</p>
                <p className="text-xs text-muted-foreground">Review items and category before saving</p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary font-bold">
              {effectiveCategory}
            </Badge>
          </div>

          {/* Photo & Category Summary Bar */}
          <div className="flex gap-4 items-center p-3 rounded-2xl bg-[#F5F3FF] border border-[#DDD6FE]">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Meal photo"
                className="w-16 h-16 rounded-xl object-cover border border-[#DDD6FE] shadow-xs shrink-0"
              />
            )}
            <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#64748B] block text-[10px] font-bold uppercase">Time</span>
                <span className="font-semibold text-[#1E293B]">{mealTime} ({hour12}:{minutes} {period})</span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px] font-bold uppercase">Category</span>
                <Select
                  value={categoryMode === 'auto' ? 'auto' : manualCategory}
                  onValueChange={(val) => {
                    if (val === 'auto') {
                      setCategoryMode('auto');
                    } else {
                      setCategoryMode('manual');
                      setManualCategory(val as MealCategory);
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs rounded-lg border-[#DDD6FE] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-[#E2E8F0]">
                    <SelectItem value="auto">Auto ({inferredCategory})</SelectItem>
                    {MEAL_CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Calorie & Macro Highlights */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6D28D9]">Calories</span>
              <span className="text-xl font-bold text-[#6D28D9] mt-0.5">{Math.round(analysisResult.calories)}</span>
              <span className="text-[9px] text-[#64748B]">kcal</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6D28D9]">Protein</span>
              <span className="text-lg font-bold text-[#1E293B] mt-0.5">{Math.round(analysisResult.protein)}g</span>
            </div>
            <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">Carbs</span>
              <span className="text-lg font-bold text-[#1E293B] mt-0.5">{Math.round(analysisResult.carbs)}g</span>
            </div>
            <div className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">Fat</span>
              <span className="text-lg font-bold text-[#1E293B] mt-0.5">{Math.round(analysisResult.fat)}g</span>
            </div>
          </div>

          {/* Identified Food Items */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-primary" /> Detected Food Items ({analysisResult.foodItems?.length || 0})
            </Label>
            <div className="space-y-2">
              {analysisResult.foodItems?.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-background border border-border hover:border-primary/30 transition-colors flex items-center justify-between"
                >
                  <div className="space-y-0.5 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md">
                        {Math.round(item.grams)}g
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex gap-2">
                      <span>P: {Math.round(item.protein)}g</span>
                      <span>•</span>
                      <span>C: {Math.round(item.carbs)}g</span>
                      <span>•</span>
                      <span>F: {Math.round(item.fat)}g</span>
                      {item.fiber !== undefined && (
                        <>
                          <span>•</span>
                          <span>Fiber: {Math.round(item.fiber)}g</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-primary">{Math.round(item.calories)} kcal</div>
                    {item.rating && (
                      <div className="text-[10px] text-amber-500 font-bold flex items-center justify-end gap-0.5">
                        <Star className="h-3 w-3 fill-amber-500" />
                        <span>{item.rating}/5</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Health Insight */}
          {analysisResult.healthInsight && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-foreground/90 space-y-1">
              <span className="font-bold text-emerald-600 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                <Info className="h-3.5 w-3.5" /> Health Insight
              </span>
              <p className="leading-relaxed">{analysisResult.healthInsight}</p>
            </div>
          )}
        </div>

        {/* Review Footer Actions */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-xl order-3 sm:order-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStage('analyze')}
            disabled={isSaving}
            className="rounded-xl order-2 flex items-center gap-1.5"
          >
            <RotateCcw className="h-4 w-4" /> Edit / Re-analyze
          </Button>
          <Button
            type="button"
            onClick={handleSaveConfirmed}
            disabled={isSaving}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-bold rounded-xl order-1 sm:order-3 shadow-md shadow-primary/20 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving Meal...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Save Meal
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STAGE A: INPUT / ANALYZE SCREEN
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-2 space-y-5">
        {/* Time of Intake + Category Override Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Time Picker */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground/80">
              <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Time of Intake
            </Label>

            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-2 gap-1.5">
                <Select value={hour12} onValueChange={setHour12}>
                  <SelectTrigger aria-label="Hour" className="border-primary/20 focus:ring-primary h-9 rounded-xl bg-background text-xs">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10">
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={h} className="text-xs">
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={minutes} onValueChange={setMinutes}>
                  <SelectTrigger aria-label="Minute" className="border-primary/20 focus:ring-primary h-9 rounded-xl bg-background text-xs">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10 max-h-[220px]">
                    {MINUTE_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex p-0.5 bg-secondary/50 rounded-xl border border-primary/10 shrink-0">
                {PERIODS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={period === p ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPeriod(p)}
                    aria-pressed={period === p}
                    aria-label={`Set time to ${p}`}
                    className={`h-7 px-2 rounded-lg text-[10px] font-bold transition-all ${
                      period === p
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
                    }`}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Meal Category (Auto Inferred + Manual Override) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center justify-between text-foreground/80">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Meal Category
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">
                {categoryMode === 'auto' ? 'Auto-inferred' : 'Manual override'}
              </span>
            </Label>

            <Select
              value={categoryMode === 'auto' ? 'auto' : manualCategory}
              onValueChange={(val) => {
                if (val === 'auto') {
                  setCategoryMode('auto');
                } else {
                  setCategoryMode('manual');
                  setManualCategory(val as MealCategory);
                }
              }}
            >
              <SelectTrigger aria-label="Meal Category" className="border-primary/20 focus:ring-primary h-9 rounded-xl bg-background text-xs">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/10">
                <SelectItem value="auto" className="text-xs font-semibold text-primary">
                  Auto (Inferred: {inferredCategory})
                </SelectItem>
                {MEAL_CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Meal Photo Upload */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground/80">
            <Camera className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Meal Photo
          </Label>
          <div className="relative group">
            <label 
              htmlFor="photo-upload" 
              className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-primary/20 rounded-2xl cursor-pointer hover:bg-primary/5 hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 transition-all overflow-hidden ${previewUrl ? 'border-primary/40 bg-primary/5' : ''}`}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Meal preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center pt-3 pb-4">
                  <div className="p-3 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors mb-2">
                    <Camera className="w-6 h-6 text-primary" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-medium text-foreground/70">Upload meal photo</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, WebP up to 10MB</p>
                </div>
              )}
              <input id="photo-upload" type="file" accept="image/*" className="sr-only" onChange={handleFileUpload} />
            </label>

            {previewUrl && (
              <Button 
                type="button"
                variant="destructive" 
                size="icon" 
                aria-label="Remove meal photo"
                className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-lg opacity-90 hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  clearSelection();
                }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>

        {/* Description textarea */}
        <div className="space-y-2">
          <Label htmlFor="meal-description" className="text-xs font-semibold flex items-center gap-1.5 text-foreground/80">
            <FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Description (Optional)
          </Label>
          <Textarea
            id="meal-description"
            placeholder="Add optional notes (e.g., 2 chapatis, spicy capsicum curry, half cup curd)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[80px] text-xs border-primary/20 focus-visible:ring-primary rounded-xl resize-none bg-background"
          />
        </div>
      </div>

      {/* Stage A Actions */}
      <div className="pt-4 border-t border-primary/10 flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isAnalyzing}
          className="order-2 sm:order-1 rounded-xl"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-sm font-bold shadow-md shadow-primary/20 rounded-xl order-1 sm:order-2 flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Analyzing with Vision AI...
            </>
          ) : (
            <>
              Analyze Meal <Sparkles className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
