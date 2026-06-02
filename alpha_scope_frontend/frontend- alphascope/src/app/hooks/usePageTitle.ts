import { useEffect } from "react";
 
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | AlphaScope`;
    return () => {
      document.title = "AlphaScope";
    };
  }, [title]);
}