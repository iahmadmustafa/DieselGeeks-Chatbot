export interface ProductCard {
  id: number;
  title: string;
  price: string;
  sale_price: string | null;
  stock_status: string;
  image_url: string | null;
  permalink: string;
  sku: string;
  fitment_expected: boolean;
  fitment_summary: string | null;
}

export type ChatUIMessage = import("ai").UIMessage<
  unknown,
  {
    products: ProductCard[];
  }
>;
