import { useState, useEffect } from 'react'
import { FileText, Mic, Sparkles, Shield, ArrowRight, ArrowLeft, Check, X } from 'lucide-react'
import { clsx } from 'clsx'

const ONBOARDING_KEY = 'lecture-note-companion-onboarded'

interface OnboardingModalProps {
  onComplete: () => void
}

interface Step {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  features: string[]
}

const steps: Step[] = [
  {
    id: 'import',
    title: 'Import Your Slides',
    description: 'Start by importing a PDF of your lecture slides. Drag and drop or click to browse.',
    icon: <FileText className="w-8 h-8" />,
    features: [
      'Support for any PDF file',
      'Automatic slide detection',
      'Text extraction for search',
      'High-quality slide previews',
    ],
  },
  {
    id: 'record',
    title: 'Record & Take Notes',
    description: 'Record lecture audio and take notes synchronized to each slide.',
    icon: <Mic className="w-8 h-8" />,
    features: [
      'Local audio recording',
      'Real-time transcription',
      'Rich text notes per slide',
      'Auto-save as you work',
    ],
  },
  {
    id: 'ai',
    title: 'Ask AI & Export',
    description: 'Get AI-powered help understanding your content and export your notes.',
    icon: <Sparkles className="w-8 h-8" />,
    features: [
      'Context-aware AI assistant',
      'Summarize lecture content',
      'Generate practice questions',
      'Export to PDF',
    ],
  },
]

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(-1) // -1 is privacy screen
  const [isExiting, setIsExiting] = useState(false)

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleBack = () => {
    if (currentStep > -1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setIsExiting(true)
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setTimeout(() => {
      onComplete()
    }, 300)
  }

  const handleSkip = () => {
    handleComplete()
  }

  // Privacy screen (step -1)
  if (currentStep === -1) {
    return (
      <div 
        className={clsx(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 transition-opacity duration-300",
          isExiting ? "opacity-0" : "opacity-100"
        )}
      >
        <div 
          className={clsx(
            "bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transition-all duration-300",
            isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
          )}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 p-8 text-white text-center">
            <button 
              onClick={handleSkip}
              className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Skip onboarding"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome to Lecture Notes</h1>
            <p className="text-zinc-300 mt-2 text-sm">Your private AI-powered note companion</p>
          </div>

          {/* Privacy content */}
          <div className="p-6">
            <div className="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl mb-6">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Privacy First</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  All your data — slides, notes, recordings, and AI conversations — stays 
                  <strong> 100% local on your device</strong>. Nothing is ever uploaded to the cloud.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-muted-foreground">No account required</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-muted-foreground">Works completely offline</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-muted-foreground">Local AI models for transcription & chat</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-muted-foreground">Your recordings stay on your device</span>
              </div>
            </div>

            <button
              onClick={handleNext}
              className="w-full btn btn-primary btn-md h-12 text-base font-medium"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
            
            <button
              onClick={handleSkip}
              className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip intro
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Tour steps
  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div 
      className={clsx(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 transition-opacity duration-300",
        isExiting ? "opacity-0" : "opacity-100"
      )}
    >
      <div 
        className={clsx(
          "bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transition-all duration-300",
          isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
        )}
      >
        {/* Progress bar */}
        <div className="h-1 bg-zinc-100">
          <div 
            className="h-full bg-zinc-900 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 p-8 text-white text-center">
          <button 
            onClick={handleSkip}
            className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Skip onboarding"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-4">
            {step.icon}
          </div>
          <h2 className="text-xl font-bold tracking-tight">{step.title}</h2>
          <p className="text-zinc-300 mt-2 text-sm max-w-sm mx-auto">{step.description}</p>
        </div>

        {/* Features */}
        <div className="p-6">
          <div className="space-y-3 mb-6">
            {step.features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 text-sm animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center">
                  <Check className="w-3 h-3 text-zinc-600" />
                </div>
                <span className="text-foreground">{feature}</span>
              </div>
            ))}
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={clsx(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentStep 
                    ? "w-6 bg-zinc-900" 
                    : index < currentStep
                      ? "bg-zinc-400"
                      : "bg-zinc-200"
                )}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="btn btn-secondary btn-md flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
            <button
              onClick={handleNext}
              className="btn btn-primary btn-md flex-1"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  Start Using App
                  <Check className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook to check if onboarding should be shown
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const hasOnboarded = localStorage.getItem(ONBOARDING_KEY)
    if (!hasOnboarded) {
      setShowOnboarding(true)
    }
  }, [])

  const completeOnboarding = () => {
    setShowOnboarding(false)
  }

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY)
    setShowOnboarding(true)
  }

  return { showOnboarding, completeOnboarding, resetOnboarding }
}

