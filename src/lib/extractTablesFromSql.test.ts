import { describe, it, expect } from "vitest";
import {
  extractTablesFromSql,
  extractPrimaryTableFromSql,
} from "./extractTablesFromSql";

describe("extractTablesFromSql", () => {
  it("extracts table from simple SELECT", () => {
    const result = extractTablesFromSql("SELECT * FROM users");
    expect(result).toEqual([{ table: "users", schema: undefined }]);
  });

  it("extracts table with schema prefix", () => {
    const result = extractTablesFromSql("SELECT * FROM public.users");
    expect(result).toEqual([{ table: "users", schema: "public" }]);
  });

  it("extracts multiple tables from JOIN", () => {
    const result = extractTablesFromSql(
      "SELECT * FROM users u JOIN orders o ON u.id = o.user_id",
    );
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ table: "users", schema: undefined });
    expect(result).toContainEqual({ table: "orders", schema: undefined });
  });

  it("extracts table from INSERT", () => {
    const result = extractTablesFromSql(
      "INSERT INTO users (name) VALUES ('John')",
    );
    expect(result).toEqual([{ table: "users", schema: undefined }]);
  });

  it("extracts table from UPDATE", () => {
    const result = extractTablesFromSql(
      "UPDATE users SET name = 'Jane' WHERE id = 1",
    );
    expect(result).toEqual([{ table: "users", schema: undefined }]);
  });

  it("extracts table from DELETE", () => {
    const result = extractTablesFromSql("DELETE FROM users WHERE id = 1");
    expect(result).toEqual([{ table: "users", schema: undefined }]);
  });

  it("handles subqueries", () => {
    const result = extractTablesFromSql(
      "SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)",
    );
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ table: "users", schema: undefined });
    expect(result).toContainEqual({ table: "orders", schema: undefined });
  });

  it("returns empty array for invalid SQL", () => {
    const result = extractTablesFromSql("not valid sql at all");
    expect(result).toEqual([]);
  });

  it("handles CTE (WITH clause)", () => {
    const result = extractTablesFromSql(`
      WITH active_users AS (SELECT * FROM users WHERE active = true)
      SELECT * FROM active_users JOIN orders ON active_users.id = orders.user_id
    `);
    expect(result).toContainEqual({ table: "users", schema: undefined });
    expect(result).toContainEqual({ table: "orders", schema: undefined });
  });
});

describe("extractPrimaryTableFromSql", () => {
  it("returns the first table", () => {
    const result = extractPrimaryTableFromSql("SELECT * FROM users");
    expect(result).toEqual({ table: "users", schema: undefined });
  });

  it("returns undefined for invalid SQL", () => {
    const result = extractPrimaryTableFromSql("invalid");
    expect(result).toBeUndefined();
  });
});
