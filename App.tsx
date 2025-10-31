
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";

// Fix: Removed global declaration for window.aistudio as it conflicts with existing types.
// The build environment is expected to provide the necessary typings.
declare global {
  interface Window {
    aistudio: any;
  }
}

const loadingMessages = [
  "Warming up the digital canvas...",
  "Analyzing image pixels and prompt context...",
  "Translating your vision into motion vectors...",
  "Rendering initial frames (this can take a few minutes)...",
  "Composing scenes and adding temporal flow...",
  "Weaving pixels into a cinematic tapestry...",
  "Applying final touches and encoding your video...",
  "Almost there, preparing your 7-second masterpiece!"
];

const FilmReelIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 4h7a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm10 0h3a1 1 0 011 1v14a1 1 0 01-1 1h-3a1 1 0 01-1-1V5a1 1 0 011-1z" />
    </svg>
);

const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const ApiKeySelection: React.FC<{ onSelect: () => void }> = ({ onSelect }) => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="bg-gray-800 p-8 rounded-lg shadow-2xl text-center max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-4 text-cyan-400">Welcome to Video Weaver</h2>
            <p className="text-gray-300 mb-6">To generate videos with the Veo model, you need to select an API key. This ensures you're ready to create stunning visuals.</p>
            <p className="text-xs text-gray-400 mb-6">For information on billing, please visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline">ai.google.dev/gemini-api/docs/billing</a>.</p>
            <button
                onClick={onSelect}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 transform hover:scale-105"
            >
                Select API Key
            </button>
        </div>
    </div>
);


export default function App() {
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const checkKey = async () => {
            try {
                if (window.aistudio) {
                    const hasKey = await window.aistudio.hasSelectedApiKey();
                    setApiKeySelected(hasKey);
                }
            } catch (e) {
                console.error("aistudio not available", e);
                // Fallback for environments where aistudio is not present
                setApiKeySelected(!!process.env.API_KEY);
            }
        };
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        try {
            await window.aistudio.openSelectKey();
            // Assume success to avoid race condition and provide immediate feedback
            setApiKeySelected(true);
        } catch (e) {
            console.error("Failed to open API key selection", e);
            setError("Could not open the API key selection dialog.");
        }
    };
    
    useEffect(() => {
        // Fix: Use ReturnType<typeof setInterval> instead of NodeJS.Timeout for browser compatibility.
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isLoading) {
            interval = setInterval(() => {
                setCurrentMessageIndex(prev => (prev + 1) % loadingMessages.length);
            }, 3500);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isLoading]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if(!file.type.startsWith('image/')) {
                setError("Please upload a valid image file.");
                return;
            }
            setImageFile(file);
            setError(null);
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setImageBase64(result.split(',')[1] || null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerateVideo = useCallback(async () => {
        if (!prompt || !imageBase64 || !imageFile) {
            setError("Please provide both an image and a prompt.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setVideoUrl(null);
        setCurrentMessageIndex(0);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            let operation = await ai.models.generateVideos({
                model: 'veo-3.1-generate-preview',
                prompt,
                image: {
                    imageBytes: imageBase64,
                    mimeType: imageFile.type,
                },
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: '16:9',
                    durationSecs: 7,
                }
            });

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({ operation });
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch video: ${response.statusText}`);
                }
                const videoBlob = await response.blob();
                const url = URL.createObjectURL(videoBlob);
                setVideoUrl(url);
            } else {
                throw new Error("Video generation completed, but no download link was found.");
            }
        } catch (err: any) {
            console.error(err);
            if (err.message?.includes("Requested entity was not found")) {
                setError("API Key is invalid or expired. Please select a valid key.");
                setApiKeySelected(false);
            } else {
                setError(`An error occurred: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [prompt, imageBase64, imageFile]);

    const resetState = () => {
        setImageFile(null);
        setImageBase64(null);
        setPrompt('');
        setVideoUrl(null);
        setError(null);
        setIsLoading(false);
    };

    if (!apiKeySelected) {
        return <ApiKeySelection onSelect={handleSelectKey} />;
    }

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-4xl">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
                        Image to Video Weaver
                    </h1>
                    <p className="text-gray-400 mt-2">Bring your images to life with a 7-second animated story.</p>
                </header>

                {isLoading ? (
                    <div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl flex flex-col items-center justify-center h-96">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400"></div>
                        <p className="mt-6 text-xl text-gray-300 font-semibold transition-opacity duration-500">{loadingMessages[currentMessageIndex]}</p>
                    </div>
                ) : videoUrl ? (
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                        <h2 className="text-2xl font-bold mb-4 text-cyan-400">Your Video is Ready!</h2>
                        <video ref={videoRef} controls autoPlay loop className="w-full rounded-lg mb-6" src={videoUrl}></video>
                        <button
                            onClick={resetState}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Create Another Video
                        </button>
                    </div>
                ) : (
                    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl space-y-6">
                        {error && <div className="bg-red-900/50 text-red-300 p-3 rounded-lg text-center">{error}</div>}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-600 rounded-lg h-64">
                                {imageBase64 ? (
                                    <img src={`data:${imageFile?.type};base64,${imageBase64}`} alt="Upload preview" className="max-h-full max-w-full object-contain rounded-md" />
                                ) : (
                                    <div className="text-center text-gray-500">
                                        <UploadIcon />
                                        <p>Upload an image</p>
                                    </div>
                                )}
                            </div>
                             <div>
                                <label htmlFor="file-upload" className="block text-sm font-medium text-gray-300 mb-2">
                                    1. Choose Your Starting Image
                                </label>
                                <input id="file-upload" type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-300 hover:file:bg-cyan-500/20 cursor-pointer"/>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
                                2. Describe the 7-Second Story
                            </label>
                            <textarea
                                id="prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., A gentle breeze rustles the leaves as the sun sets, casting long shadows."
                                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 resize-none h-28"
                            />
                        </div>

                        <div>
                            <button
                                onClick={handleGenerateVideo}
                                disabled={!prompt || !imageBase64}
                                className="w-full flex items-center justify-center bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                            >
                                <FilmReelIcon />
                                Generate 7s Video
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
