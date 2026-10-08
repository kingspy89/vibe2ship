import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Camera, MapPin, Loader2, Upload } from 'lucide-react';
import { generateId } from '../lib/utils';
import { useAuth } from '../components/AuthProvider';
import { storage } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export function Report() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [address, setAddress] = useState('');
  const [locating, setLocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places && autocompleteInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
        fields: ['geometry', 'formatted_address']
      });
      
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
          setLocation({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          });
          setAddress(place.formatted_address || '');
        }
      });
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 320;

          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setPreview(canvas.toDataURL('image/jpeg', 0.5));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const getLocation = () => {
    setLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocating(false);
        },
        (error) => {
          console.error("Error getting location", error);
          setLocating(false);
          // Fallback to a mock location in Koramangala, Bangalore for the demo if it fails
          setLocation({ lat: 12.9352, lng: 77.6245 });
        }
      );
    } else {
      setLocating(false);
      setLocation({ lat: 12.9352, lng: 77.6245 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview || !location) return;

    setIsSubmitting(true);
    try {
      // 2. Call our API
      const base64Data = preview.split(',')[1];
      const mimeType = preview.split(';')[0].split(':')[1];
      const approxBytes = Math.ceil((base64Data.length * 3) / 4);
      if (approxBytes > 3_500_000) {
        throw new Error('Image is still too large for Vercel upload. Please retry with a smaller image or lower resolution.');
      }

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoBase64: base64Data,
          mimeType,
          caption,
          lat: location.lat,
          lng: location.lng,
          userId: user?.uid || 'anonymous'
        })
      });
      if (!res.ok) {
        const text = await res.text();
        let errMsg = `Server returned ${res.status}: ${res.statusText}`;
        try {
          const json = JSON.parse(text);
          if (json.error) errMsg = json.error;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.success) {
        navigate(`/issue/${data.issue_id}`, { state: { reportResponse: data, previewImage: preview } });
      } else {
        alert("Error: " + data.error);
      }
    } catch (error: any) {
      console.error(error);
      alert("Failed to submit report. Details: " + (error?.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Card className="bg-[#1C1D26] border-slate-800/60 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white text-xl font-bold">Report an Issue</CardTitle>
          <CardDescription className="text-slate-400">Take a photo of the problem. Our AI will do the rest.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Photo Upload */}
            <div 
              className="border-2 border-dashed border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center bg-[#12131A] cursor-pointer hover:bg-slate-800/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-64 rounded-md object-contain" />
              ) : (
                <div className="text-center space-y-2">
                  <Camera className="h-10 w-10 text-slate-500 mx-auto" />
                  <p className="text-sm font-medium text-slate-300">Tap to take photo or upload</p>
                  <p className="text-xs text-slate-500">Supports JPEG, PNG up to 10MB</p>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Location</label>
              
              <div className="flex gap-2 mb-2">
                <input
                  ref={autocompleteInputRef}
                  type="text"
                  placeholder="Enter location manually..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-md border border-slate-800 bg-[#12131A] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant={location ? "default" : "outline"} 
                  onClick={getLocation}
                  disabled={locating}
                  className="w-full flex justify-start border-slate-800 text-slate-300 hover:bg-slate-800/40"
                >
                  <MapPin className="h-4 w-4 mr-2 text-indigo-400" />
                  {locating ? "Locating..." : location ? `Captured: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Get GPS Location"}
                </Button>
              </div>
            </div>

            {/* Optional Caption */}
            <div className="space-y-2">
              <label htmlFor="caption" className="text-sm font-medium text-slate-300">Additional details (Optional)</label>
              <textarea 
                id="caption"
                className="w-full rounded-md border border-slate-800 bg-[#12131A] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
                placeholder="e.g., The leak is getting worse..."
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors" 
              disabled={!preview || !location || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                  Analyzing AI Pipeline...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
