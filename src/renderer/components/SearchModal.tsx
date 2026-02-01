import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { Search, X, FileText, MessageSquare, Mic, ArrowRight, Sparkles, Filter } from 'lucide-react'
import { clsx } from 'clsx'

interface SearchResult {
  type: 'slide' | 'note' | 'transcript' | 'enhanced'
  slideIndex: number
  slideId: string
  text: string
  matchStart: number
  matchEnd: number
}

type ResultFilter = 'all' | 'slide' | 'note' | 'transcript' | 'enhanced'

interface SearchModalProps {
  onClose: () => void
}

export function SearchModal({ onClose }: SearchModalProps) {
  const { session, setCurrentSlide } = useSessionStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filter, setFilter] = useState<ResultFilter>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Search logic
  const allResults = useMemo((): SearchResult[] => {
    if (!session || !query.trim()) return []

    const searchQuery = query.toLowerCase().trim()
    const results: SearchResult[] = []

    session.slides.forEach((slide, index) => {
      // Search slide text
      if (slide.extractedText) {
        const text = slide.extractedText.toLowerCase()
        const matchIndex = text.indexOf(searchQuery)
        if (matchIndex !== -1) {
          results.push({
            type: 'slide',
            slideIndex: index,
            slideId: slide.id,
            text: slide.extractedText,
            matchStart: matchIndex,
            matchEnd: matchIndex + searchQuery.length,
          })
        }
      }

      // Search notes
      const note = session.notes[slide.id]
      if (note?.plainText) {
        const text = note.plainText.toLowerCase()
        const matchIndex = text.indexOf(searchQuery)
        if (matchIndex !== -1) {
          results.push({
            type: 'note',
            slideIndex: index,
            slideId: slide.id,
            text: note.plainText,
            matchStart: matchIndex,
            matchEnd: matchIndex + searchQuery.length,
          })
        }
      }

      // Search enhanced notes
      const enhancedNote = session.enhancedNotes?.[slide.id]
      if (enhancedNote?.plainText && enhancedNote.status === 'complete') {
        const text = enhancedNote.plainText.toLowerCase()
        const matchIndex = text.indexOf(searchQuery)
        if (matchIndex !== -1) {
          results.push({
            type: 'enhanced',
            slideIndex: index,
            slideId: slide.id,
            text: enhancedNote.plainText,
            matchStart: matchIndex,
            matchEnd: matchIndex + searchQuery.length,
          })
        }
      }

      // Search transcripts
      const transcripts = session.transcripts[slide.id]
      if (transcripts && transcripts.length > 0) {
        const combinedText = transcripts.map(t => t.text).join(' ')
        const lowerText = combinedText.toLowerCase()
        const matchIndex = lowerText.indexOf(searchQuery)
        if (matchIndex !== -1) {
          results.push({
            type: 'transcript',
            slideIndex: index,
            slideId: slide.id,
            text: combinedText,
            matchStart: matchIndex,
            matchEnd: matchIndex + searchQuery.length,
          })
        }
      }
    })

    return results
  }, [session, query])

  // Filter results
  const results = useMemo(() => {
    if (filter === 'all') return allResults
    return allResults.filter(r => r.type === filter)
  }, [allResults, filter])

  // Count results by type
  const resultCounts = useMemo(() => {
    const counts = { slide: 0, note: 0, enhanced: 0, transcript: 0 }
    allResults.forEach(r => {
      counts[r.type]++
    })
    return counts
  }, [allResults])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        handleSelect(results[selectedIndex])
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [results, selectedIndex, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsRef.current
    if (!container) return

    const selectedElement = container.children[selectedIndex] as HTMLElement
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleSelect = useCallback((result: SearchResult) => {
    setCurrentSlide(result.slideIndex)
    onClose()
  }, [setCurrentSlide, onClose])

  // Highlight matched text
  const highlightMatch = (text: string, start: number, end: number) => {
    const before = text.slice(Math.max(0, start - 40), start)
    const match = text.slice(start, end)
    const after = text.slice(end, end + 60)
    
    return (
      <span className="text-sm">
        {start > 40 && <span className="text-muted-foreground">...</span>}
        <span className="text-muted-foreground">{before}</span>
        <mark className="bg-yellow-200 text-foreground font-medium px-0.5 rounded">{match}</mark>
        <span className="text-muted-foreground">{after}</span>
        {after.length >= 60 && <span className="text-muted-foreground">...</span>}
      </span>
    )
  }

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'slide':
        return <FileText className="w-4 h-4 text-zinc-500" />
      case 'note':
        return <MessageSquare className="w-4 h-4 text-blue-500" />
      case 'enhanced':
        return <Sparkles className="w-4 h-4 text-amber-500" />
      case 'transcript':
        return <Mic className="w-4 h-4 text-green-500" />
    }
  }

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'slide':
        return 'Slide'
      case 'note':
        return 'Note'
      case 'enhanced':
        return 'Enhanced'
      case 'transcript':
        return 'Transcript'
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search slides, notes, and transcripts..."
            className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <kbd className="kbd text-[10px]">ESC</kbd>
        </div>

        {/* Filters */}
        {query.trim() && allResults.length > 0 && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-zinc-50/50">
            <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
            <button
              onClick={() => setFilter('all')}
              className={clsx(
                'px-2 py-1 text-[10px] font-medium rounded-full transition-colors',
                filter === 'all'
                  ? 'bg-zinc-900 text-white'
                  : 'text-muted-foreground hover:bg-zinc-100'
              )}
            >
              All ({allResults.length})
            </button>
            {resultCounts.slide > 0 && (
              <button
                onClick={() => setFilter('slide')}
                className={clsx(
                  'px-2 py-1 text-[10px] font-medium rounded-full transition-colors flex items-center gap-1',
                  filter === 'slide'
                    ? 'bg-zinc-700 text-white'
                    : 'text-muted-foreground hover:bg-zinc-100'
                )}
              >
                <FileText className="w-3 h-3" />
                Slides ({resultCounts.slide})
              </button>
            )}
            {resultCounts.note > 0 && (
              <button
                onClick={() => setFilter('note')}
                className={clsx(
                  'px-2 py-1 text-[10px] font-medium rounded-full transition-colors flex items-center gap-1',
                  filter === 'note'
                    ? 'bg-blue-500 text-white'
                    : 'text-muted-foreground hover:bg-zinc-100'
                )}
              >
                <MessageSquare className="w-3 h-3" />
                Notes ({resultCounts.note})
              </button>
            )}
            {resultCounts.enhanced > 0 && (
              <button
                onClick={() => setFilter('enhanced')}
                className={clsx(
                  'px-2 py-1 text-[10px] font-medium rounded-full transition-colors flex items-center gap-1',
                  filter === 'enhanced'
                    ? 'bg-amber-500 text-white'
                    : 'text-muted-foreground hover:bg-zinc-100'
                )}
              >
                <Sparkles className="w-3 h-3" />
                Enhanced ({resultCounts.enhanced})
              </button>
            )}
            {resultCounts.transcript > 0 && (
              <button
                onClick={() => setFilter('transcript')}
                className={clsx(
                  'px-2 py-1 text-[10px] font-medium rounded-full transition-colors flex items-center gap-1',
                  filter === 'transcript'
                    ? 'bg-green-500 text-white'
                    : 'text-muted-foreground hover:bg-zinc-100'
                )}
              >
                <Mic className="w-3 h-3" />
                Transcripts ({resultCounts.transcript})
              </button>
            )}
          </div>
        )}

        {/* Results */}
        <div 
          ref={resultsRef}
          className="max-h-[400px] overflow-y-auto"
        >
          {!query.trim() && (
            <div className="p-8 text-center">
              <Search className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Type to search across all slides, notes, and transcripts
              </p>
            </div>
          )}

          {query.trim() && results.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm">
                No results found for "{query}"
              </p>
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.slideId}-${index}`}
              onClick={() => handleSelect(result)}
              className={clsx(
                "w-full px-4 py-3 text-left flex items-start gap-3 transition-colors border-b border-border last:border-0",
                index === selectedIndex
                  ? "bg-zinc-100"
                  : "hover:bg-zinc-50"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(result.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {getTypeLabel(result.type)}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs font-medium text-foreground">
                    Slide {result.slideIndex + 1}
                  </span>
                </div>
                <div className="truncate">
                  {highlightMatch(result.text, result.matchStart, result.matchEnd)}
                </div>
              </div>
              <ArrowRight className={clsx(
                "w-4 h-4 flex-shrink-0 mt-1 transition-opacity",
                index === selectedIndex ? "opacity-100 text-foreground" : "opacity-0"
              )} />
            </button>
          ))}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 bg-zinc-50 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="kbd text-[10px]">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="kbd text-[10px]">↵</kbd>
                Go to slide
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

