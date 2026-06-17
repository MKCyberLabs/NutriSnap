
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
      // Robust error handling to prevent UI crashes
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
    <Card className="border-accent/20 bg-accent/5 backdrop-blur-sm shadow-xl animate-in zoom-in-95 duration-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-headline text-xl text-primary flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent animate-pulse" /> Health Matrix Bot
            </CardTitle>
            <CardDescription>Get instant biological insights for your {category}</CardDescription>
          </div>
          <Badge variant="outline" className="border-accent text-accent">{category}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> Input meal details
          </label>
          <Textarea 
            placeholder="E.g., Chicken breast with brown rice..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[100px] border-accent/20 focus-visible:ring-accent"
          />
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-accent/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or upload photo</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          {photoDataUri ? (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border group">
              <img src={photoDataUri} alt="Meal preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="secondary" size="sm" onClick={() => setPhotoDataUri(null)}>
                  Change Photo
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <label 
                htmlFor="photo-upload" 
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-accent/30 rounded-lg cursor-pointer hover:bg-accent/10 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Camera className="w-8 h-8 text-accent mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload meal photo</p>
                </div>
                <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={isAnalyzing}>Cancel</Button>
        <Button onClick={handleAnalyze} disabled={isAnalyzing} className="flex-1 bg-primary hover:bg-primary/90">
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simulating AI Analysis...
            </>
          ) : (
            <>
              Analyze with Health Matrix <Sparkles className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
