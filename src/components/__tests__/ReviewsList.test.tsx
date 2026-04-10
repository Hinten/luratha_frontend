import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ReviewsList from "@/src/components/produto/ReviewsList";
import type { Review } from "@/src/lib/types";

const mockReviews: Review[] = [
  {
    id: "r1",
    author: "Ana Claudia",
    rating: 5,
    comment: "Amei o vestido! Qualidade incrível.",
    date: "2026-03-15",
  },
  {
    id: "r2",
    author: "Fernanda Lima",
    rating: 4,
    comment: "Muito bonito, recomendo.",
    date: "2026-02-28",
  },
];

describe("ReviewsList", () => {
  it("renders the empty state when there are no reviews", () => {
    render(<ReviewsList reviews={[]} />);
    expect(
      screen.getByText(/ainda não possui avaliações/i)
    ).toBeInTheDocument();
  });

  it("renders the author name for each review", () => {
    render(<ReviewsList reviews={mockReviews} />);
    expect(screen.getByText("Ana Claudia")).toBeInTheDocument();
    expect(screen.getByText("Fernanda Lima")).toBeInTheDocument();
  });

  it("renders the review comment", () => {
    render(<ReviewsList reviews={mockReviews} />);
    expect(screen.getByText("Amei o vestido! Qualidade incrível.")).toBeInTheDocument();
  });

  it("renders the average score in the summary", () => {
    render(<ReviewsList reviews={mockReviews} />);
    // Average of 5 and 4 = 4.5
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("renders the review count", () => {
    render(<ReviewsList reviews={mockReviews} />);
    expect(screen.getByText(/2 avaliações/)).toBeInTheDocument();
  });

  it("renders the section with correct aria-label", () => {
    render(<ReviewsList reviews={mockReviews} />);
    expect(
      screen.getByRole("region", { name: "Avaliações do produto" })
    ).toBeInTheDocument();
  });

  it("renders star ratings with accessible aria-labels", () => {
    render(<ReviewsList reviews={mockReviews} />);
    // The summary + 2 review items all have star ratings
    const ratingElements = screen.getAllByLabelText(/de 5 estrelas/);
    expect(ratingElements.length).toBeGreaterThan(0);
  });

  it("renders a list with all reviews", () => {
    render(<ReviewsList reviews={mockReviews} />);
    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(mockReviews.length);
  });
});
