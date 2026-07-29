export {};

declare global {
  interface Window {
    wc_add_to_cart_params?: {
      wc_ajax_url?: string;
      ajax_url?: string;
      cart_url?: string;
    };
    jQuery?: {
      each: (
        collection: Record<string, string> | unknown[],
        callback: (key: string | number, value: string) => void,
      ) => void;
      (selector: string): {
        replaceWith: (html: string) => void;
      };
      (target: Document): {
        trigger: (event: string, args?: unknown[]) => void;
      };
    };
  }
}
