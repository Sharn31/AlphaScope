import { useState, useRef, useEffect } from "react";
import { Search, TrendingUp } from "lucide-react";
import { Input } from "./ui/input";
import { searchStocks, StockOption } from "../data/stocks";
import { useTheme } from "../context/ThemeContext";

interface StockSearchProps {
  onSelect: (stock: StockOption) => void;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export default function StockSearch({ 
  onSelect, 
  placeholder = "Search stocks by symbol or name...",
  value = "",
  onChange 
}: StockSearchProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<StockOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { isDarkMode } = useTheme();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
    
    const searchResults = searchStocks(newValue);
    setResults(searchResults);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleSelect = (stock: StockOption) => {
    setInputValue(stock.symbol);
    onChange?.(stock.symbol);
    onSelect(stock);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        const searchResults = searchStocks(inputValue);
        setResults(searchResults);
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleFocus = () => {
    const searchResults = searchStocks(inputValue);
    setResults(searchResults);
    setIsOpen(true);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
          isDarkMode ? 'text-slate-500' : 'text-slate-400'
        }`} />
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`pl-10 ${
            isDarkMode 
              ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' 
              : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
          }`}
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className={`absolute z-50 w-full mt-2 rounded-lg shadow-2xl border overflow-hidden ${
          isDarkMode 
            ? 'bg-slate-800 border-slate-700' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="max-h-80 overflow-y-auto">
            {results.map((stock, index) => (
              <button
                key={stock.symbol}
                onClick={() => handleSelect(stock)}
                className={`w-full px-4 py-3 text-left transition-colors ${
                  index === selectedIndex
                    ? isDarkMode 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-50 text-blue-900'
                    : isDarkMode
                      ? 'hover:bg-slate-700 text-white'
                      : 'hover:bg-slate-50 text-slate-900'
                } ${index !== results.length - 1 ? (isDarkMode ? 'border-b border-slate-700' : 'border-b border-slate-200') : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${
                        index === selectedIndex
                          ? 'text-white'
                          : isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`}>
                        {stock.symbol}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {stock.exchange}
                      </span>
                    </div>
                    <p className={`text-sm mt-0.5 truncate ${
                      index === selectedIndex
                        ? 'text-blue-100'
                        : isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {stock.name}
                    </p>
                  </div>
                  {stock.sector && (
                    <div className="ml-2">
                      <TrendingUp className={`w-4 h-4 ${
                        index === selectedIndex
                          ? 'text-blue-200'
                          : isDarkMode ? 'text-slate-600' : 'text-slate-400'
                      }`} />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className={`px-4 py-2 text-xs border-t ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-700 text-slate-500' 
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            Use ↑↓ to navigate, Enter to select, Esc to close
          </div>
        </div>
      )}
    </div>
  );
}
