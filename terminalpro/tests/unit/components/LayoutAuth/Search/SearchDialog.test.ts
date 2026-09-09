import { describe, it, expect } from 'vitest';

describe('Search term filtering', () => {
  const runSearchTermFiltering = (filterDebounced: string, minMatchCharLength = 2) => {
    const searchTerms = filterDebounced.trim().split(/\s+/);
    const validSearchTerms = searchTerms.filter(term => term.length >= minMatchCharLength);
    const termsToSearch = validSearchTerms.length > 0 ? validSearchTerms : searchTerms;
    return { searchTerms, validSearchTerms, termsToSearch };
  };

  it('should filter out terms shorter than minMatchCharLength', () => {
    const result = runSearchTermFiltering("Plotly C");
    
    expect(result.searchTerms).toEqual(["Plotly", "C"]);
    expect(result.validSearchTerms).toEqual(["Plotly"]); // "C" is filtered out
    expect(result.termsToSearch).toEqual(["Plotly"]); // Should only search for "Plotly"
  });

  it('should preserve all terms when all are valid length', () => {
    const result = runSearchTermFiltering("Plotly Ch");
    
    expect(result.searchTerms).toEqual(["Plotly", "Ch"]);
    expect(result.validSearchTerms).toEqual(["Plotly", "Ch"]);
    expect(result.termsToSearch).toEqual(["Plotly", "Ch"]);
  });

  it('should fallback to original terms if no valid terms', () => {
    const result = runSearchTermFiltering("A B");
    
    expect(result.searchTerms).toEqual(["A", "B"]);
    expect(result.validSearchTerms).toEqual([]); // Both are filtered out
    expect(result.termsToSearch).toEqual(["A", "B"]); // Fallback to original
  });

  it('should handle single short term correctly', () => {
    const result = runSearchTermFiltering("C");
    
    expect(result.searchTerms).toEqual(["C"]);
    expect(result.validSearchTerms).toEqual([]); // "C" is filtered out
    expect(result.termsToSearch).toEqual(["C"]); // Fallback to original
  });

  it('should handle empty string', () => {
    const result = runSearchTermFiltering("");
    
    expect(result.searchTerms).toEqual([""]);
    expect(result.validSearchTerms).toEqual([]); // Empty string is filtered out
    expect(result.termsToSearch).toEqual([""]); // Fallback to original
  });

  it('should handle mixed valid and invalid terms', () => {
    const result = runSearchTermFiltering("Chart A Widget B");
    
    expect(result.searchTerms).toEqual(["Chart", "A", "Widget", "B"]);
    expect(result.validSearchTerms).toEqual(["Chart", "Widget"]); // "A" and "B" filtered out
    expect(result.termsToSearch).toEqual(["Chart", "Widget"]);
  });

  it('should handle extra whitespace', () => {
    const result = runSearchTermFiltering("  Plotly   C  ");
    
    expect(result.searchTerms).toEqual(["Plotly", "C"]);
    expect(result.validSearchTerms).toEqual(["Plotly"]);
    expect(result.termsToSearch).toEqual(["Plotly"]);
  });
});