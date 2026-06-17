'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Camera, FileText, Loader2, Sparkles, Clock, X } from 'lucide-react';
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

interface MealAnalysisToolProps {
  category: MealCategory;
  onAnalysisComplete: (data: MealNutritionalAnalysisOutput, mealTime: string, imagePath?: string) => void;
  onCancel: () => void;
}

export function MealAnalysisTool({ category, onAnalysisComplete, onCancel }: MealAnalysisToolProps) {
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  // Custom Time State
  const [hour12, setHour12] = useState(() => format(new Date(), 'hh'));
  const [minutes, setMinutes] = useState(() => format(new Date(), 'mm'));
  const [period, setPeriod] = useState(() => format(new Date(), 'a'));
  const [mealTime, setMealTime] = useState(() => format(new Date(), 'HH:mm'));

  // Cleanup object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
    }
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  const handleAnalyze = async () => {
    if (!description && !selectedFile) {
      toast({
        variant: "destructive",
        title: "Missing input",
        description: "Please provide a description or upload a photo of your meal.",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      let uploadedPath: string | undefined;

      // 1. Upload photo to local storage first (Disk IO optimization)
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          uploadedPath = data.url;
        } else {
          toast({ variant: "destructive", title: "Upload failed", description: "Could not save image to local storage." });
        }
      }

      // 2. Perform AI analysis by calling the local Health Matrix API endpoint
      // This is the source of truth for all nutritional analysis
      const res = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealDescription: description,
          imagePath: uploadedPath,
          mealTime: mealTime,
        }),
      });

      // Crucial: Call .json() only ONCE to prevent parsing errors
      const resultData = await res.json();

      if (!res.ok) {
        // Surface specific error details if provided by the backend
        throw new Error(resultData.details || resultData.error || 'Health Matrix Analysis Failed');
      }

      onAnalysisComplete(resultData as MealNutritionalAnalysisOutput, mealTime, uploadedPath);
    } catch (error: any) {
      console.error("Health Matrix API Error:", error);
      toast({
        variant: "destructive",
        title: "Analysis issue",
        description: error.message || "The Health Matrix API encountered an error.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        <div className="space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
            <Clock className="h-4 w-4 text-primary" /> Time of Intake
          </Label>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <Select value={hour12} onValueChange={setHour12}>
                <SelectTrigger className="border-primary/20 focus:ring-primary h-10 rounded-xl bg-background">
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  {hours.map((h) => (
                    <SelectItem key={h} value={h} className="focus:bg-primary/10 focus:text-primary rounded-lg">
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={minutes} onValueChange={setMinutes}>
                <SelectTrigger className="border-primary/20 focus:ring-primary h-10 rounded-xl bg-background">
                  <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10 max-h-[300px]">
                  {minuteOptions.map((m) => (
                    <SelectItem key={m} value={m} className="focus:bg-primary/10 focus:text-primary rounded-lg">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex p-1 bg-secondary/50 rounded-xl border border-primary/10">
              {['AM', 'PM'].map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={period === p ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriod(p)}
                  className={`h-8 px-3 rounded-lg text-[10px] font-bold transition-all ${
                    period === p 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
                  }`}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
            <FileText className="h-4 w-4 text-primary" /> Describe your meal
          </Label>
          <Textarea 
            placeholder="E.g., Grilled chicken with quinoa and steamed broccoli..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[120px] border-primary/20 focus-visible:ring-primary rounded-xl resize-none bg-background"
          />
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-primary/10" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
            <span className="bg-background px-4 text-muted-foreground">Visual Intake</span>
          </div>
        </div>

        <div className="w-full">
          <div className="relative group">
            <label 
              htmlFor="photo-upload" 
              className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-primary/20 rounded-2xl cursor-pointer hover:bg-primary/5 hover:border-primary/40 transition-all overflow-hidden ${previewUrl ? 'border-primary/40 bg-primary/5' : ''}`}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Meal preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="p-4 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors mb-3">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground/70">Upload meal photo</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                </div>
              )}
              <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>

            {previewUrl && (
              <Button 
                variant="destructive" 
                size="icon" 
                className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  clearSelection();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-primary/5 flex flex-col sm:flex-row gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={isAnalyzing} className="order-2 sm:order-1 rounded-xl">
          Cancel
        </Button>
        <Button onClick={handleAnalyze} disabled={isAnalyzing} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-md font-bold shadow-lg shadow-primary/20 rounded-xl order-1 sm:order-2">
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing...
            </>
          ) : (
            <>
              Analyze with Health Matrix <Sparkles className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
