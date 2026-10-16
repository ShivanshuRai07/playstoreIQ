"""
PlayStoreIQ — OLAP Engine Service
Implements native SQL-backed OLAP operations:
1. Roll-up (Hierarchical Aggregation: Genre -> Category, or Month -> Quarter -> Year)
2. Drill-down (Granular Decomposition: Category -> Genre / Apps, or Year -> Quarter -> Month)
3. Slice (1D conditional filter across the fact cube)
4. Dice (Multi-D sub-cube projection)
5. Pivot (2D Cross-tabulation matrix)

Every operation returns both the aggregated analytical dataset and the exact executing SQL statement.
"""
import os
import sys
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from database.connection import execute_query

class OLAPService:

    @staticmethod
    def rollup_by_category():
        """Roll-up: Aggregates granular fact records to high-level Category dimension."""
        sql = """
            SELECT 
                c.category_name AS dimension_key,
                c.domain_group AS domain_group,
                COUNT(f.fact_id) AS total_apps,
                SUM(f.installs_count) AS total_installs,
                ROUND(AVG(f.rating), 2) AS avg_rating,
                ROUND(AVG(f.price_usd), 2) AS avg_price,
                ROUND(AVG(f.size_mb), 2) AS avg_size_mb,
                ROUND(AVG(f.avg_sentiment_polarity), 3) AS avg_polarity
            FROM fact_app f
            JOIN dim_category c ON f.category_id = c.category_id
            GROUP BY c.category_name, c.domain_group
            ORDER BY total_installs DESC
        """
        df = execute_query(sql)
        return {
            "operation": "ROLL-UP",
            "hierarchy": "App -> Genre -> Category",
            "sql_query": sql.strip(),
            "row_count": len(df),
            "data": df.to_dict(orient="records")
        }

    @staticmethod
    def rollup_by_time_hierarchy(level="quarter"):
        """Roll-up: Temporal aggregation Day -> Month -> Quarter -> Year."""
        if level == "year":
            group_cols = "d.year_num"
            select_key = "CAST(d.year_num AS TEXT)"
        elif level == "month":
            group_cols = "d.year_num, d.month_num, d.month_name"
            select_key = "d.year_num || '-' || substr('0' || d.month_num, -2, 2)"
        else: # quarter
            group_cols = "d.year_num, d.quarter_num"
            select_key = "d.year_num || ' Q' || d.quarter_num"

        sql = f"""
            SELECT 
                {select_key} AS time_period,
                COUNT(f.fact_id) AS apps_updated,
                SUM(f.installs_count) AS total_installs,
                ROUND(AVG(f.rating), 2) AS avg_rating
            FROM fact_app f
            JOIN dim_date d ON f.date_id = d.date_id
            GROUP BY {group_cols}
            ORDER BY {group_cols} ASC
        """
        df = execute_query(sql)
        return {
            "operation": "ROLL-UP",
            "hierarchy": f"Date -> {level.title()}",
            "sql_query": sql.strip(),
            "row_count": len(df),
            "data": df.to_dict(orient="records")
        }

    @staticmethod
    def drilldown_category_to_genres(category_name="GAME"):
        """Drill-down: Decomposes a single high-level category into its sub-genres."""
        sql = """
            SELECT 
                g.genre_name AS sub_dimension,
                g.primary_genre,
                COUNT(f.fact_id) AS app_count,
                SUM(f.installs_count) AS total_installs,
                ROUND(AVG(f.rating), 2) AS avg_rating,
                ROUND(AVG(f.price_usd), 2) AS avg_price
            FROM fact_app f
            JOIN dim_category c ON f.category_id = c.category_id
            JOIN dim_genre g ON f.genre_id = g.genre_id
            WHERE c.category_name = :cat
            GROUP BY g.genre_name, g.primary_genre
            ORDER BY total_installs DESC
        """
        df = execute_query(sql, params={"cat": category_name})
        return {
            "operation": "DRILL-DOWN",
            "hierarchy": f"Category ({category_name}) -> Genres",
            "parent_value": category_name,
            "sql_query": sql.strip(),
            "row_count": len(df),
            "data": df.to_dict(orient="records")
        }

    @staticmethod
    def slice_by_dimension(dimension_name="type", slice_value="Free"):
        """Slice: Takes a 1-dimensional cut across the fact cube."""
        if dimension_name.lower() == "type":
            dim_table = "dim_type"
            dim_col = "type_name"
            fk_col = "type_id"
        elif dimension_name.lower() == "content_rating":
            dim_table = "dim_content_rating"
            dim_col = "rating_name"
            fk_col = "content_rating_id"
        else: # default to domain group
            dim_table = "dim_category"
            dim_col = "domain_group"
            fk_col = "category_id"

        sql = f"""
            SELECT 
                c.category_name,
                COUNT(f.fact_id) AS app_count,
                SUM(f.installs_count) AS total_installs,
                ROUND(AVG(f.rating), 2) AS avg_rating,
                ROUND(AVG(f.price_usd), 2) AS avg_price
            FROM fact_app f
            JOIN {dim_table} d ON f.{fk_col} = d.{fk_col}
            JOIN dim_category c ON f.category_id = c.category_id
            WHERE d.{dim_col} = :slice_val
            GROUP BY c.category_name
            ORDER BY total_installs DESC
        """
        df = execute_query(sql, params={"slice_val": slice_value})
        return {
            "operation": "SLICE",
            "dimension": dimension_name,
            "slice_filter": f"{dim_table}.{dim_col} = '{slice_value}'",
            "sql_query": sql.strip(),
            "row_count": len(df),
            "data": df.to_dict(orient="records")
        }

    @staticmethod
    def dice_subcube(categories=None, type_name="Free", content_rating="Everyone"):
        """Dice: Extracts a multi-dimensional sub-cube via simultaneous filtering."""
        if categories is None:
            categories = ["GAME", "FAMILY", "PRODUCTIVITY"]

        placeholders = ", ".join([f":cat_{i}" for i in range(len(categories))])
        params = {f"cat_{i}": cat for i, cat in enumerate(categories)}
        params["type_name"] = type_name
        params["content_rating"] = content_rating

        sql = f"""
            SELECT 
                c.category_name,
                t.type_name,
                cr.rating_name AS content_rating,
                COUNT(f.fact_id) AS app_count,
                SUM(f.installs_count) AS total_installs,
                ROUND(AVG(f.rating), 2) AS avg_rating
            FROM fact_app f
            JOIN dim_category c ON f.category_id = c.category_id
            JOIN dim_type t ON f.type_id = t.type_id
            JOIN dim_content_rating cr ON f.content_rating_id = cr.content_rating_id
            WHERE c.category_name IN ({placeholders})
              AND t.type_name = :type_name
              AND cr.rating_name = :content_rating
            GROUP BY c.category_name, t.type_name, cr.rating_name
            ORDER BY total_installs DESC
        """
        df = execute_query(sql, params=params)
        return {
            "operation": "DICE",
            "subcube_criteria": {
                "categories": categories,
                "type": type_name,
                "content_rating": content_rating
            },
            "sql_query": sql.strip(),
            "row_count": len(df),
            "data": df.to_dict(orient="records")
        }

    @staticmethod
    def pivot_category_by_type(metric="installs"):
        """Pivot: 2D cross-tabulation rotating Categories (rows) by Pricing Type (columns)."""
        if metric == "rating":
            agg_free = "ROUND(AVG(CASE WHEN t.type_name = 'Free' THEN f.rating END), 2)"
            agg_paid = "ROUND(AVG(CASE WHEN t.type_name = 'Paid' THEN f.rating END), 2)"
        elif metric == "count":
            agg_free = "COUNT(CASE WHEN t.type_name = 'Free' THEN f.fact_id END)"
            agg_paid = "COUNT(CASE WHEN t.type_name = 'Paid' THEN f.fact_id END)"
        else: # default installs
            agg_free = "COALESCE(SUM(CASE WHEN t.type_name = 'Free' THEN f.installs_count END), 0)"
            agg_paid = "COALESCE(SUM(CASE WHEN t.type_name = 'Paid' THEN f.installs_count END), 0)"

        sql = f"""
            SELECT 
                c.category_name,
                {agg_free} AS free_metric,
                {agg_paid} AS paid_metric,
                COUNT(f.fact_id) AS total_apps
            FROM fact_app f
            JOIN dim_category c ON f.category_id = c.category_id
            JOIN dim_type t ON f.type_id = t.type_id
            GROUP BY c.category_name
            ORDER BY c.category_name ASC
        """
        df = execute_query(sql)
        return {
            "operation": "PIVOT",
            "metric": metric,
            "row_axis": "dim_category.category_name",
            "col_axis": "dim_type.type_name ('Free' vs 'Paid')",
            "sql_query": sql.strip(),
            "row_count": len(df),
            "data": df.to_dict(orient="records")
        }
