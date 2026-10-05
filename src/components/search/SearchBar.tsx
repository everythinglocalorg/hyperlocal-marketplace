"use client";

import { useRef } from "react";
import AtMentionDropdown from "@/components/AtMentionDropdown";
import SearchPredictive from "@/components/search/SearchPredictive";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, onSearch, placeholder }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onSearch();
  }

  return (
    <div className="relative flex items-center">
      <svg
        className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Search..."}
        className="w-full pl-9 pr-20 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); inputRef.current?.focus(); }}
          aria-label="Clear search"
          className="absolute right-11 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      )}
      {/* Submit arrow — tap to run the search (Enter still works). */}
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search"
        className="absolute right-1.5 w-8 h-8 flex items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
      <AtMentionDropdown query={value} />
      <SearchPredictive query={value} onSearchAll={onSearch} rememberBase="/search" />
    </div>
  );
}
