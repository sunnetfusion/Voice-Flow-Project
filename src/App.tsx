import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, Settings, Type, Clock, Users, Heart, Star, Trash2, Mic, MicOff, Download, Upload, Camera, Image, FileText, Loader2, X } from 'lucide-react';
import { createWorker } from 'tesseract.js';

interface Voice {
  name: string;
  lang: string;
  voiceURI: string;
}

interface FavoriteVoice {
  id: string;
  name: string;
  voiceURI: string;
  speed: number;
  pitch: number;
  createdAt: number;
}

interface VoiceRecording {
  id: string;
  name: string;
  blob: Blob;
  duration: number;
  createdAt: number;
}

function App() {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showRecordings, setShowRecordings] = useState(false);
  const [favoriteVoices, setFavoriteVoices] = useState<FavoriteVoice[]>([]);
  const [favoriteName, setFavoriteName] = useState('');
  const [voiceRecordings, setVoiceRecordings] = useState<VoiceRecording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingName, setRecordingName] = useState('');
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedRecordingForComparison, setSelectedRecordingForComparison] = useState<string | null>(null);
  const [showOCR, setShowOCR] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const favoritesRef = useRef<HTMLDivElement>(null);
  const recordingsRef = useRef<HTMLDivElement>(null);
  const ocrRef = useRef<HTMLDivElement>(null);

  const exampleTexts = [
    "Hello, how are you today?",
    "The quick brown fox jumps over the lazy dog.",
    "Welcome to our text-to-speech application!",
    "Practice makes perfect.",
    "Technology is advancing rapidly in the modern world."
  ];

  // Load favorites and recordings from localStorage on component mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('voiceflow-favorites');
    if (savedFavorites) {
      try {
        setFavoriteVoices(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('Error loading favorites:', error);
      }
    }

    const savedRecordings = localStorage.getItem('voiceflow-recordings');
    if (savedRecordings) {
      try {
        const recordings = JSON.parse(savedRecordings);
        // Convert base64 back to Blob for each recording
        const processedRecordings = recordings.map((recording: any) => ({
          ...recording,
          blob: base64ToBlob(recording.blobData, 'audio/webm')
        }));
        setVoiceRecordings(processedRecordings);
      } catch (error) {
        console.error('Error loading recordings:', error);
      }
    }
  }, []);

  // Save favorites to localStorage whenever favoriteVoices changes
  useEffect(() => {
    if (favoriteVoices.length >= 0) { // Allow empty array to be saved
      localStorage.setItem('voiceflow-favorites', JSON.stringify(favoriteVoices));
    }
  }, [favoriteVoices]);

  // Save recordings to localStorage whenever voiceRecordings changes
  useEffect(() => {
    const saveRecordings = async () => {
      try {
        const recordingsToSave = await Promise.all(
          voiceRecordings.map(async (recording) => ({
            id: recording.id,
            name: recording.name,
            duration: recording.duration,
            createdAt: recording.createdAt,
            blobData: await blobToBase64(recording.blob)
          }))
        );
        localStorage.setItem('voiceflow-recordings', JSON.stringify(recordingsToSave));
      } catch (error) {
        console.error('Error saving recordings:', error);
      }
    };

    if (voiceRecordings.length >= 0) { // Allow empty array to be saved
      saveRecordings();
    } else {
      // If array is empty, save empty array to localStorage
      localStorage.setItem('voiceflow-recordings', JSON.stringify([]));
    }
  }, [voiceRecordings]);

  // Helper functions for blob/base64 conversion
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:audio/webm;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    
    const loadVoices = () => {
      const availableVoices = synthRef.current?.getVoices() || [];
      const voiceList = availableVoices.map(voice => ({
        name: voice.name,
        lang: voice.lang,
        voiceURI: voice.voiceURI
      }));
      setVoices(voiceList);
      
      // Set default voice (preferably English)
      const defaultVoice = availableVoices.find(voice => 
        voice.lang.startsWith('en') && voice.default
      ) || availableVoices[0];
      
      if (defaultVoice) {
        setSelectedVoice(defaultVoice.voiceURI);
      }
    };

    loadVoices();
    
    // Some browsers load voices asynchronously
    if (synthRef.current) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const speak = () => {
    if (!text.trim() || !synthRef.current) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find(v => v.voiceURI === selectedVoice);
    
    if (voice) {
      const speechVoice = synthRef.current.getVoices().find(v => v.voiceURI === voice.voiceURI);
      if (speechVoice) {
        utterance.voice = speechVoice;
      }
    }

    utterance.rate = speed;
    utterance.pitch = pitch;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const pause = () => {
    if (synthRef.current && isPlaying) {
      synthRef.current.pause();
      setIsPaused(true);
    }
  };

  const resume = () => {
    if (synthRef.current && isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
    }
  };

  const stop = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying && !isPaused) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      speak();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const duration = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
        
        if (recordingName.trim()) {
          const newRecording: VoiceRecording = {
            id: Date.now().toString(),
            name: recordingName.trim(),
            blob: audioBlob,
            duration,
            createdAt: Date.now()
          };
          
          setVoiceRecordings(prev => [...prev, newRecording]);
          setRecordingName('');
        }

        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = (recording: VoiceRecording) => {
    const audio = new Audio(URL.createObjectURL(recording.blob));
    setPlayingRecordingId(recording.id);
    
    audio.onended = () => {
      setPlayingRecordingId(null);
    };
    
    audio.onerror = () => {
      setPlayingRecordingId(null);
    };
    
    audio.play();
  };

  const downloadRecording = (recording: VoiceRecording) => {
    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.name}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deleteRecording = (id: string) => {
    setVoiceRecordings(prev => {
      const updated = prev.filter(recording => recording.id !== id);
      // Immediately save to localStorage to prevent restoration
      const saveUpdatedRecordings = async () => {
        try {
          if (updated.length === 0) {
            localStorage.setItem('voiceflow-recordings', JSON.stringify([]));
          } else {
            const recordingsToSave = await Promise.all(
              updated.map(async (recording) => ({
                id: recording.id,
                name: recording.name,
                duration: recording.duration,
                createdAt: recording.createdAt,
                blobData: await blobToBase64(recording.blob)
              }))
            );
            localStorage.setItem('voiceflow-recordings', JSON.stringify(recordingsToSave));
          }
        } catch (error) {
          console.error('Error saving recordings after deletion:', error);
        }
      };
      saveUpdatedRecordings();
      return updated;
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getWordCount = () => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const getReadingTime = () => {
    const words = getWordCount();
    const wordsPerMinute = 150; // Average reading speed
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes;
  };

  const handleExampleClick = (example: string) => {
    setText(example);
    setShowSettings(false);
  };

  const saveFavoriteVoice = () => {
    if (!favoriteName.trim() || !selectedVoice) return;

    const currentVoice = voices.find(v => v.voiceURI === selectedVoice);
    if (!currentVoice) return;

    const newFavorite: FavoriteVoice = {
      id: Date.now().toString(),
      name: favoriteName.trim(),
      voiceURI: selectedVoice,
      speed,
      pitch,
      createdAt: Date.now()
    };

    setFavoriteVoices(prev => [...prev, newFavorite]);
    setFavoriteName('');
  };

  const loadFavoriteVoice = (favorite: FavoriteVoice) => {
    setSelectedVoice(favorite.voiceURI);
    setSpeed(favorite.speed);
    setPitch(favorite.pitch);
    setShowFavorites(false);
  };

  const deleteFavoriteVoice = (id: string) => {
    setFavoriteVoices(prev => {
      const updated = prev.filter(fav => fav.id !== id);
      // Immediately save to localStorage to prevent restoration
      localStorage.setItem('voiceflow-favorites', JSON.stringify(updated));
      return updated;
    });
  };

  const playComparison = async (recording: VoiceRecording) => {
    if (!text.trim()) {
      alert('Please enter some text first to compare with your recording.');
      return;
    }

    // First play the TTS
    speak();
    
    // Wait for TTS to finish, then play the recording
    const checkTTSFinished = () => {
      if (!isPlaying) {
        setTimeout(() => {
          playRecording(recording);
        }, 500); // Small delay between TTS and recording
      } else {
        setTimeout(checkTTSFinished, 100);
      }
    };
    
    setTimeout(checkTTSFinished, 100);
  };

  const processImageWithOCR = async (imageFile: File | string) => {
    setIsProcessingOCR(true);
    setOcrProgress(0);

    try {
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const { data: { text } } = await worker.recognize(imageFile);
      await worker.terminate();

      // Clean up the extracted text
      const cleanedText = text
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanedText) {
        // Append to existing text or replace if empty
        setText(prevText => {
          const separator = prevText.trim() ? ' ' : '';
          return prevText + separator + cleanedText;
        });
        setShowOCR(false);
        setCapturedImage(null);
      } else {
        alert('No text was detected in the image. Please try with a clearer image.');
      }
    } catch (error) {
      console.error('OCR Error:', error);
      alert('Failed to process the image. Please try again with a different image.');
    } finally {
      setIsProcessingOCR(false);
      setOcrProgress(0);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageWithOCR(file);
    } else {
      alert('Please select a valid image file.');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera Error:', error);
      alert('Could not access camera. Please check permissions or try uploading an image instead.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageDataUrl);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const processCapture = () => {
    if (capturedImage) {
      processImageWithOCR(capturedImage);
    }
  };

  const closeOCR = () => {
    setShowOCR(false);
    setCapturedImage(null);
    stopCamera();
  };

  // Cleanup camera stream on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const getCurrentVoiceName = () => {
    const voice = voices.find(v => v.voiceURI === selectedVoice);
    return voice ? voice.name : 'Unknown Voice';
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  };

  const handleSettingsToggle = () => {
    setShowSettings(!showSettings);
    if (!showSettings) {
      // Small delay to allow the element to render before scrolling
      setTimeout(() => scrollToSection(settingsRef), 100);
    }
  };

  const handleFavoritesToggle = () => {
    setShowFavorites(!showFavorites);
    if (!showFavorites) {
      setTimeout(() => scrollToSection(favoritesRef), 100);
    }
  };

  const handleRecordingsToggle = () => {
    setShowRecordings(!showRecordings);
    if (!showRecordings) {
      setTimeout(() => scrollToSection(recordingsRef), 100);
    }
  };

  const handleOCRToggle = () => {
    setShowOCR(!showOCR);
    if (!showOCR) {
      setTimeout(() => scrollToSection(ocrRef), 100);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg">
              <Volume2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              VoiceFlow
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Transform your text into natural, clear speech • Record voice samples • Extract text from images
          </p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Text Input Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
              <div className="flex items-center gap-2 mb-4">
                <Type className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-800">Enter Your Text</h2>
              </div>
              
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste your text here. Enter words, sentences, or longer passages to hear them spoken aloud..."
                className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-700 placeholder-gray-400 bg-white/50 backdrop-blur-sm"
                maxLength={5000}
              />
              
              <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Type className="w-4 h-4" />
                    {text.length}/5000 characters
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {getWordCount()} words
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    ~{getReadingTime()} min read
                  </span>
                </div>
              </div>
            </div>

            {/* Example Texts */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Examples</h3>
              <div className="flex flex-wrap gap-2">
                {exampleTexts.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(example)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 transform hover:scale-105 text-sm font-medium shadow-md"
                  >
                    {example.substring(0, 30)}...
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Controls Section */}
          <div className="space-y-6">
            {/* Playback Controls */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Playback Controls</h3>
              
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={handlePlayPause}
                  disabled={!text.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
                >
                  {isPlaying && !isPaused ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  {isPlaying && !isPaused ? 'Pause' : isPaused ? 'Resume' : 'Play'}
                </button>
                
                <button
                  onClick={stop}
                  disabled={!isPlaying && !isPaused}
                  className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  <Square className="w-5 h-5" />
                </button>
              </div>

              {/* Control Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleSettingsToggle}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
                >
                  <Settings className="w-4 h-4" />
                  Voice Settings
                </button>
                
                <button
                  onClick={handleFavoritesToggle}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all duration-200 font-medium shadow-md"
                >
                  <Heart className="w-4 h-4" />
                  Favorite Voices ({favoriteVoices.length})
                </button>

                <button
                  onClick={handleRecordingsToggle}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium shadow-md"
                >
                  <Mic className="w-4 h-4" />
                  Voice Samples ({voiceRecordings.length})
                </button>

                <button
                  onClick={handleOCRToggle}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-md"
                >
                  <Camera className="w-4 h-4" />
                  Scan Text
                </button>
              </div>
            </div>

            {/* Voice Settings */}
            {showSettings && (
              <div ref={settingsRef} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Voice Settings</h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ×
                  </button>
                </div>

                {/* Voice Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voice
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm"
                  >
                    {voices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Speed Control */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Speed: {speed}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0.5x</span>
                    <span>2x</span>
                  </div>
                </div>

                {/* Pitch Control */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pitch: {pitch}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>

                {/* Save as Favorite */}
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Save Current Settings as Favorite
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={favoriteName}
                      onChange={(e) => setFavoriteName(e.target.value)}
                      placeholder="Enter favorite name..."
                      className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      maxLength={30}
                    />
                    <button
                      onClick={saveFavoriteVoice}
                      disabled={!favoriteName.trim() || !selectedVoice}
                      className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium shadow-md"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Favorite Voices */}
            {showFavorites && (
              <div ref={favoritesRef} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Favorite Voices</h3>
                  <button
                    onClick={() => setShowFavorites(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ×
                  </button>
                </div>

                {favoriteVoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Heart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No favorite voices saved yet.</p>
                    <p className="text-sm mt-1">Configure a voice and save it as a favorite!</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {favoriteVoices.map((favorite) => {
                      const voice = voices.find(v => v.voiceURI === favorite.voiceURI);
                      return (
                        <div
                          key={favorite.id}
                          className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl border border-pink-100 hover:from-pink-100 hover:to-rose-100 transition-all duration-200"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Star className="w-4 h-4 text-pink-500 flex-shrink-0" />
                              <h4 className="font-medium text-gray-800 truncate">{favorite.name}</h4>
                            </div>
                            <p className="text-sm text-gray-600 truncate">
                              {voice ? voice.name : 'Voice not available'} • {favorite.speed}x • Pitch: {favorite.pitch}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <button
                              onClick={() => loadFavoriteVoice(favorite)}
                              disabled={!voice}
                              className="px-3 py-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium shadow-sm"
                            >
                              Use
                            </button>
                            <button
                              onClick={() => deleteFavoriteVoice(favorite.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all duration-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Voice Recordings */}
            {showRecordings && (
              <div ref={recordingsRef} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Voice Samples</h3>
                  <button
                    onClick={() => setShowRecordings(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ×
                  </button>
                </div>

                {/* Recording Controls */}
                <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Mic className="w-5 h-5 text-orange-600" />
                    <h4 className="font-medium text-gray-800">Record Your Voice</h4>
                  </div>
                  
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-700">
                      <strong>💡 How to use:</strong> Type your text above, then record yourself saying it. 
                      Use the comparison feature to hear TTS followed by your recording!
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={recordingName}
                      onChange={(e) => setRecordingName(e.target.value)}
                      placeholder="Enter recording name..."
                      className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                      maxLength={30}
                      disabled={isRecording}
                    />
                    
                    <div className="flex gap-2">
                      {!isRecording ? (
                        <button
                          onClick={startRecording}
                          disabled={!recordingName.trim()}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md"
                        >
                          <Mic className="w-4 h-4" />
                          Start Recording
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 font-medium shadow-md animate-pulse"
                        >
                          <MicOff className="w-4 h-4" />
                          Stop Recording
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recordings List */}
                {voiceRecordings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Mic className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No voice samples recorded yet.</p>
                    <p className="text-sm mt-1">Record yourself saying the text to compare pronunciation!</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {voiceRecordings.map((recording) => (
                      <div
                        key={recording.id}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-100 hover:from-orange-100 hover:to-red-100 transition-all duration-200"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Mic className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            <h4 className="font-medium text-gray-800 truncate">{recording.name}</h4>
                          </div>
                          <p className="text-sm text-gray-600">
                            Duration: {formatDuration(recording.duration)} • {new Date(recording.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={() => playComparison(recording)}
                            disabled={!text.trim() || isPlaying || playingRecordingId === recording.id}
                            className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium shadow-sm"
                            title="Play TTS then your recording for comparison"
                          >
                            Compare
                          </button>
                          <button
                            onClick={() => playRecording(recording)}
                            disabled={playingRecordingId === recording.id}
                            className="p-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                            title="Play only your recording"
                          >
                            {playingRecordingId === recording.id ? (
                              <Volume2 className="w-4 h-4 animate-pulse" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => downloadRecording(recording)}
                            className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-all duration-200"
                            title="Download recording"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteRecording(recording.id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all duration-200"
                            title="Delete recording"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {voiceRecordings.length > 0 && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-sm text-green-700">
                      <strong>🎯 Pro Tip:</strong> Enter text above, record yourself saying it, then use "Compare" 
                      to hear the TTS version followed by your recording. Perfect for pronunciation practice!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* OCR Text Recognition */}
            {showOCR && (
              <div ref={ocrRef} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Scan Text from Image</h3>
                  <button
                    onClick={closeOCR}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isProcessingOCR ? (
                  <div className="text-center py-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                      <span className="text-lg font-medium text-gray-700">Processing Image...</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600">{ocrProgress}% complete</p>
                  </div>
                ) : capturedImage ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <img 
                        src={capturedImage} 
                        alt="Captured" 
                        className="w-full max-h-64 object-contain rounded-lg border border-gray-200"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={processCapture}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 font-medium shadow-lg"
                      >
                        <FileText className="w-5 h-5" />
                        Extract Text
                      </button>
                      <button
                        onClick={retakePhoto}
                        className="px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all duration-200 font-medium shadow-lg"
                      >
                        Retake
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Camera View */}
                    {videoRef.current?.srcObject && (
                      <div className="relative">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full max-h-64 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          onClick={capturePhoto}
                          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 p-4 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-all duration-200"
                        >
                          <Camera className="w-6 h-6 text-purple-600" />
                        </button>
                      </div>
                    )}

                    {/* Hidden canvas for photo capture */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        onClick={startCamera}
                        className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-lg"
                      >
                        <Camera className="w-6 h-6" />
                        <div className="text-left">
                          <div className="font-semibold">Take Photo</div>
                          <div className="text-sm opacity-90">Use camera to capture text</div>
                        </div>
                      </button>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl hover:from-indigo-600 hover:to-blue-600 transition-all duration-200 font-medium shadow-lg"
                      >
                        <Upload className="w-6 h-6" />
                        <div className="text-left">
                          <div className="font-semibold">Upload Image</div>
                          <div className="text-sm opacity-90">Select from gallery</div>
                        </div>
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    {/* Instructions */}
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-purple-800 mb-2">How to get best results:</h4>
                          <ul className="text-sm text-purple-700 space-y-1">
                            <li>• Ensure good lighting and clear text</li>
                            <li>• Hold camera steady and focus on the text</li>
                            <li>• Works best with printed text (books, documents, signs)</li>
                            <li>• Avoid shadows and reflections</li>
                            <li>• Text will be added to your current text area</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Status Indicator */}
            {(isPlaying || isPaused) && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isPlaying && !isPaused ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                  <div className="flex-1">
                    <span className="text-green-700 font-medium block">
                      {isPlaying && !isPaused ? 'Speaking...' : 'Paused'}
                    </span>
                    <span className="text-green-600 text-sm">
                      {getCurrentVoiceName()} • {speed}x • Pitch: {pitch}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}

export default App;