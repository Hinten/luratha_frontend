"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string;
  price: number;
  size: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartState | null>(null);

const STORAGE_KEY = "luratha_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  /** true once we have attempted to load from localStorage */
  const [hydrated, setHydrated] = useState(false);

  /* Load from localStorage on mount (SSR-safe) */
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setItems(JSON.parse(stored) as CartItem[]);
        }
      } catch (err) {
        // Bad JSON or storage blocked — start with an empty cart.
        if (!(err instanceof SyntaxError || err instanceof DOMException)) {
          throw err;
        }
      }
      setHydrated(true);
    }
  }, []);

  /* Persist to localStorage — only after hydration to avoid overwriting stored data */
  useEffect(() => {
    if (hydrated && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, hydrated]);

  const addItem = useCallback((newItem: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === newItem.productId && i.size === newItem.size,
      );
      if (existing) {
        return prev.map((i) =>
          i.productId === newItem.productId && i.size === newItem.size
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...prev, { ...newItem, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string, size: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.productId === productId && i.size === size)),
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: string, size: string, quantity: number) => {
      if (quantity <= 0) {
        setItems((prev) =>
          prev.filter((i) => !(i.productId === productId && i.size === size)),
        );
      } else {
        setItems((prev) =>
          prev.map((i) =>
            i.productId === productId && i.size === size
              ? { ...i, quantity }
              : i,
          ),
        );
      }
    },
    [],
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
