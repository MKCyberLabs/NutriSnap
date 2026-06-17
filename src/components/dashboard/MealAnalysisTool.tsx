
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Camera, FileText, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { mealNutritionalAnalysis, MealNutritionalAnalysisOutput } from '@/ai/flows/meal-nutritional-analysis';
import { useToast } from '@/hooks/use-toast';
import { MealCategory } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface MealAnalysisToolProps {
  category: MealCategory;
  onAnalysisComplete: (data: MealNutritionalAnalysisOutput) => void;
  onCancel: () => void;
}

export function MealAnalysisTool({ category, onAnalysisComplete, onCancel }: MealAnalysisToolProps) {
  const [description, setDescription] = useState('');
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoDataUri(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!description && !photoDataUri) {
      toast({
        variant: "destructive",
        title: "Missing input",
        description: "Please provide a description or upload a photo of your meal.",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await mealNutritionalAnalysis({
        mealDescription: description,
        mealPhotoDataUri: photoDataUri || undefined,
      });
      onAnalysisComplete(result);
    } catch (error) {
      console.error("Health Matrix Bot Error:", error);
      toast({
        variant: "destructive",
        title: "Analysis issue",
        description: "The analysis system encountered an error. Logging details to console.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
            <FileText className="h-4 w-4 text-primary" /> Describe your meal
          </label>
          <Textarea 
            placeholder="E.g., Grilled chicken with quinoa and steamed broccoli..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[120px] border-primary/20 focus-visible:ring-primary rounded-xl resize-none"
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

        <div className="flex flex-col items-center gap-4">
          {photoDataUri ? (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-primary/10 group shadow-inner bg-muted">
              <img src={photoDataUri} alt="Meal preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="secondary" size="sm" onClick={() => setPhotoDataUri(null)} className="rounded-full">
                  Change Photo
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <label 
                htmlFor="photo-upload" 
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-primary/20 rounded-2xl cursor-pointer hover:bg-primary/5 hover:border-primary/40 transition-all group"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="p-4 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors mb-3">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground/70">Upload meal photo</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                </div>
                <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-primary/5 flex flex-col sm:flex-row gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={isAnalyzing} className="order-2 sm:order-1">
          Cancel
        </Button>
        <Button onClick={handleAnalyze} disabled={isAnalyzing} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-md font-bold shadow-lg shadow-primary/20 rounded-xl order-1 sm:order-2">
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Simulating AI Analysis...
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
