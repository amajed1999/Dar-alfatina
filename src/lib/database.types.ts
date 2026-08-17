export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_notes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          metadata: Json
          note_date: string
          note_number: string | null
          notes: string | null
          reason: string
          reason_type: string
          status: string
          total_cost: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          note_date?: string
          note_number?: string | null
          notes?: string | null
          reason: string
          reason_type?: string
          status?: string
          total_cost?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          note_date?: string
          note_number?: string | null
          notes?: string | null
          reason?: string
          reason_type?: string
          status?: string
          total_cost?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: []
      }
      consumption_note_items: {
        Row: {
          consumption_note_id: string
          id: string
          line_cost: number | null
          metadata: Json
          product_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          consumption_note_id: string
          id?: string
          line_cost?: number | null
          metadata?: Json
          product_id: string
          quantity: number
          unit_cost?: number
        }
        Update: {
          consumption_note_id?: string
          id?: string
          line_cost?: number | null
          metadata?: Json
          product_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumption_note_items_consumption_note_id_fkey"
            columns: ["consumption_note_id"]
            isOneToOne: false
            referencedRelation: "consumption_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          exchange_rate: number
          expense_date: string
          expense_number: string | null
          id: string
          metadata: Json
          notes: string | null
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          exchange_rate?: number
          expense_date?: string
          expense_number?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          exchange_rate?: number
          expense_date?: string
          expense_number?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_users: {
        Row: {
          created_at: string
          created_by: string | null
          merchant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          merchant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          merchant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_users_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_visits: {
        Row: {
          accuracy: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          merchant_id: string
          metadata: Json
          notes: string | null
          outcome: string
          rep_id: string | null
          visited_at: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          merchant_id: string
          metadata?: Json
          notes?: string | null
          outcome?: string
          rep_id?: string | null
          visited_at?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          merchant_id?: string
          metadata?: Json
          notes?: string | null
          outcome?: string
          rep_id?: string | null
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_visits_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          address: string | null
          assigned_rep: string | null
          created_at: string
          created_by: string | null
          credit_limit: number
          deleted_at: string | null
          id: string
          metadata: Json
          name: string
          notes: string | null
          phone: string | null
          price_tier_id: string | null
          province: string | null
          registration_date: string
          shop_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_rep?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          deleted_at?: string | null
          id?: string
          metadata?: Json
          name: string
          notes?: string | null
          phone?: string | null
          price_tier_id?: string | null
          province?: string | null
          registration_date?: string
          shop_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_rep?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          deleted_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          notes?: string | null
          phone?: string | null
          price_tier_id?: string | null
          province?: string | null
          registration_date?: string
          shop_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchants_assigned_rep_fkey"
            columns: ["assigned_rep"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_price_tier_id_fkey"
            columns: ["price_tier_id"]
            isOneToOne: false
            referencedRelation: "price_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          exchange_rate: number
          id: string
          merchant_id: string
          metadata: Json
          method: string
          notes: string | null
          payment_date: string
          payment_number: string | null
          reference_no: string | null
          rep_id: string | null
          settlement_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          exchange_rate?: number
          id?: string
          merchant_id: string
          metadata?: Json
          method?: string
          notes?: string | null
          payment_date?: string
          payment_number?: string | null
          reference_no?: string | null
          rep_id?: string | null
          settlement_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          exchange_rate?: number
          id?: string
          merchant_id?: string
          metadata?: Json
          method?: string
          notes?: string | null
          payment_date?: string
          payment_number?: string | null
          reference_no?: string | null
          rep_id?: string | null
          settlement_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount: number
          id: string
          payment_id: string
          sales_invoice_id: string
        }
        Insert: {
          amount: number
          id?: string
          payment_id: string
          sales_invoice_id: string
        }
        Update: {
          amount?: number
          id?: string
          payment_id?: string
          sales_invoice_id?: string
        }
        Relationships: []
      }
      rep_settlements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          metadata: Json
          notes: string | null
          received_by: string | null
          rep_id: string
          settlement_date: string
          settlement_number: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          received_by?: string | null
          rep_id: string
          settlement_date?: string
          settlement_number?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          received_by?: string | null
          rep_id?: string
          settlement_date?: string
          settlement_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          module: string
          name_ar: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          module: string
          name_ar: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          module?: string
          name_ar?: string
        }
        Relationships: []
      }
      price_tiers: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          key: string
          name_ar: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          key: string
          name_ar: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          key?: string
          name_ar?: string
          sort_order?: number
        }
        Relationships: []
      }
      product_prices: {
        Row: {
          currency: string
          id: string
          price: number
          price_tier_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          currency?: string
          id?: string
          price?: number
          price_tier_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          currency?: string
          id?: string
          price?: number
          price_tier_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_price_tier_id_fkey"
            columns: ["price_tier_id"]
            isOneToOne: false
            referencedRelation: "price_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          base_unit_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          current_cost: number
          deleted_at: string | null
          has_expiry: boolean
          id: string
          is_active: boolean
          metadata: Json
          name: string
          pack_unit_id: string | null
          reorder_level: number
          sku: string
          units_per_pack: number | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          base_unit_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          current_cost?: number
          deleted_at?: string | null
          has_expiry?: boolean
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          pack_unit_id?: string | null
          reorder_level?: number
          sku: string
          units_per_pack?: number | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          base_unit_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          current_cost?: number
          deleted_at?: string | null
          has_expiry?: boolean
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          pack_unit_id?: string | null
          reorder_level?: number
          sku?: string
          units_per_pack?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_base_unit_id_fkey"
            columns: ["base_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_pack_unit_id_fkey"
            columns: ["pack_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_items: {
        Row: {
          discount: number
          id: string
          line_total: number | null
          metadata: Json
          product_id: string
          purchase_invoice_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          discount?: number
          id?: string
          line_total?: number | null
          metadata?: Json
          product_id: string
          purchase_invoice_id: string
          quantity: number
          unit_cost?: number
        }
        Update: {
          discount?: number
          id?: string
          line_total?: number | null
          metadata?: Json
          product_id?: string
          purchase_invoice_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          discount: number
          exchange_rate: number
          id: string
          invoice_date: string
          invoice_number: string | null
          metadata: Json
          notes: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          total: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount?: number
          exchange_rate?: number
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          metadata?: Json
          notes?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          total?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount?: number
          exchange_rate?: number
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          metadata?: Json
          notes?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          total?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_system: boolean
          key: string
          metadata: Json
          name_ar: string
          name_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          metadata?: Json
          name_ar: string
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          metadata?: Json
          name_ar?: string
          name_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sales_invoice_items: {
        Row: {
          discount: number
          id: string
          line_cogs: number | null
          line_total: number | null
          metadata: Json
          product_id: string
          quantity: number
          sales_invoice_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          discount?: number
          id?: string
          line_cogs?: number | null
          line_total?: number | null
          metadata?: Json
          product_id: string
          quantity: number
          sales_invoice_id: string
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          discount?: number
          id?: string
          line_cogs?: number | null
          line_total?: number | null
          metadata?: Json
          product_id?: string
          quantity?: number
          sales_invoice_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cogs_total: number
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          discount: number
          exchange_rate: number
          id: string
          invoice_date: string
          invoice_number: string | null
          merchant_id: string
          metadata: Json
          notes: string | null
          paid_amount: number
          rep_id: string | null
          sale_type: string
          status: string
          subtotal: number
          total: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cogs_total?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount?: number
          exchange_rate?: number
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          merchant_id: string
          metadata?: Json
          notes?: string | null
          paid_amount?: number
          rep_id?: string | null
          sale_type?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cogs_total?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount?: number
          exchange_rate?: number
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          merchant_id?: string
          metadata?: Json
          notes?: string | null
          paid_amount?: number
          rep_id?: string | null
          sale_type?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_balances"
            referencedColumns: ["merchant_id"]
          },
          {
            foreignKeyName: "sales_invoices_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return_items: {
        Row: {
          id: string
          line_total: number | null
          metadata: Json
          product_id: string
          quantity: number
          sales_return_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_total?: number | null
          metadata?: Json
          product_id: string
          quantity: number
          sales_return_id: string
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          id?: string
          line_total?: number | null
          metadata?: Json
          product_id?: string
          quantity?: number
          sales_return_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_sales_return_id_fkey"
            columns: ["sales_return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          exchange_rate: number
          id: string
          merchant_id: string
          metadata: Json
          notes: string | null
          original_invoice_id: string | null
          return_date: string
          return_number: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          exchange_rate?: number
          id?: string
          merchant_id: string
          metadata?: Json
          notes?: string | null
          original_invoice_id?: string | null
          return_date?: string
          return_number?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          exchange_rate?: number
          id?: string
          merchant_id?: string
          metadata?: Json
          notes?: string | null
          original_invoice_id?: string | null
          return_date?: string
          return_number?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_balances"
            referencedColumns: ["merchant_id"]
          },
          {
            foreignKeyName: "sales_returns_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          metadata: Json
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          metadata?: Json
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          metadata?: Json
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          metadata: Json
          priority: string
          related_id: string | null
          related_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          priority?: string
          related_id?: string | null
          related_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          priority?: string
          related_id?: string | null
          related_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          task_id: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          task_id: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          full_name: string | null
          id: string
          is_active: boolean
          metadata: Json
          phone: string | null
          role_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          metadata?: Json
          phone?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          phone?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          is_default: boolean
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_inventory_report: {
        Row: {
          below_reorder: boolean | null
          category_name: string | null
          is_active: boolean | null
          last_movement_at: string | null
          name: string | null
          product_id: string | null
          reorder_level: number | null
          sku: string | null
          stock_qty: number | null
          stock_value: number | null
          unit_cost: number | null
        }
        Relationships: []
      }
      v_invoice_outstanding: {
        Row: {
          allocated: number | null
          invoice_date: string | null
          invoice_number: string | null
          merchant_id: string | null
          paid_amount: number | null
          remaining: number | null
          sale_type: string | null
          total: number | null
          invoice_id: string | null
        }
        Relationships: []
      }
      v_merchant_balances: {
        Row: {
          balance: number | null
          merchant_id: string | null
          total_paid_initial: number | null
          total_payments: number | null
          total_returns: number | null
          total_sales: number | null
        }
        Relationships: []
      }
      v_rep_custody: {
        Row: {
          custody_amount: number | null
          receipts_count: number | null
          rep_id: string | null
        }
        Relationships: []
      }
      v_products: {
        Row: {
          barcode: string | null
          base_unit_id: string | null
          base_unit_name: string | null
          below_reorder: boolean | null
          category_id: string | null
          category_name: string | null
          created_at: string | null
          current_cost: number | null
          has_expiry: boolean | null
          id: string | null
          is_active: boolean | null
          name: string | null
          pack_unit_id: string | null
          pack_unit_name: string | null
          reorder_level: number | null
          sku: string | null
          stock_qty: number | null
          units_per_pack: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_stock_by_warehouse: {
        Row: {
          product_id: string | null
          qty: number | null
          warehouse_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_list_users: {
        Args: Record<string, never>
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string
          role_id: string
          role_name: string
        }[]
      }
      approve_purchase_invoice: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      approve_sales_invoice: {
        Args: { p_invoice_id: string; p_override_credit?: boolean }
        Returns: undefined
      }
      approve_sales_return: {
        Args: { p_return_id: string }
        Returns: undefined
      }
      approve_consumption_note: {
        Args: { p_note_id: string }
        Returns: undefined
      }
      create_task: {
        Args: {
          p_title: string
          p_description: string | null
          p_priority: string
          p_due_date: string | null
          p_related_type: string | null
          p_related_id: string | null
          p_assignees: string[]
        }
        Returns: string
      }
      update_task: {
        Args: {
          p_task_id: string
          p_title: string
          p_description: string | null
          p_priority: string
          p_due_date: string | null
          p_related_type: string | null
          p_related_id: string | null
          p_assignees: string[]
        }
        Returns: undefined
      }
      update_task_status: {
        Args: { p_task_id: string; p_status: string }
        Returns: undefined
      }
      add_task_comment: {
        Args: { p_task_id: string; p_body: string }
        Returns: string
      }
      delete_task: {
        Args: { p_task_id: string }
        Returns: undefined
      }
      notify_due_tasks: {
        Args: Record<string, never>
        Returns: number
      }
      monthly_sales: {
        Args: { p_months?: number }
        Returns: {
          month_start: string
          sales_total: number
          collected_total: number
        }[]
      }
      portal_summary: {
        Args: Record<string, never>
        Returns: {
          merchant_id: string
          merchant_name: string
          shop_name: string
          balance: number
          credit_limit: number
          over_limit: boolean
          open_invoices: number
        }[]
      }
      portal_invoices: {
        Args: Record<string, never>
        Returns: {
          invoice_id: string
          invoice_number: string
          invoice_date: string
          sale_type: string
          total: number
          paid_amount: number
          remaining: number
          status: string
        }[]
      }
      link_merchant_portal: {
        Args: { p_merchant: string; p_email: string }
        Returns: undefined
      }
      unlink_merchant_portal: {
        Args: { p_merchant: string }
        Returns: undefined
      }
      item_movement: {
        Args: { p_product: string; p_from?: string; p_to?: string }
        Returns: {
          mv_date: string
          movement_type: string
          quantity: number
          running: number
          reference_type: string | null
          notes: string | null
        }[]
      }
      rep_performance: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          rep_id: string
          rep_name: string
          sales_total: number
          invoices_count: number
          collections_total: number
          merchants_count: number
          visits_count: number
        }[]
      }
      report_sales_by_merchant: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          merchant_id: string
          merchant_name: string
          invoices_count: number
          total_sales: number
        }[]
      }
      report_sales_by_product: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          product_id: string
          product_name: string
          sku: string
          qty: number
          revenue: number
        }[]
      }
      report_sales_by_region: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          region: string
          invoices_count: number
          total_sales: number
        }[]
      }
      list_active_users: {
        Args: Record<string, never>
        Returns: {
          id: string
          full_name: string
          role_name: string
        }[]
      }
      profit_loss: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          gross_sales: number
          returns_total: number
          net_sales: number
          cogs: number
          gross_profit: number
          operating_expenses: number
          consumption_cost: number
          net_profit: number
          collected: number
          collection_ratio: number
        }[]
      }
      profit_by_product: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          product_id: string
          product_name: string
          sku: string
          qty: number
          revenue: number
          cogs: number
          profit: number
        }[]
      }
      profit_by_merchant: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          merchant_id: string
          merchant_name: string
          revenue: number
          cogs: number
          profit: number
        }[]
      }
      aging_report: {
        Args: { p_as_of?: string; p_rep?: string }
        Returns: {
          merchant_id: string
          merchant_name: string
          b0_30: number
          b31_60: number
          b61_90: number
          b90_plus: number
          total: number
        }[]
      }
      merchant_statement: {
        Args: { p_merchant: string; p_from?: string; p_to?: string }
        Returns: {
          entry_date: string
          sort_ts: string
          kind: string
          ref: string
          description: string
          debit: number
          credit: number
          running: number
        }[]
      }
      record_payment: {
        Args: {
          p_merchant: string
          p_amount: number
          p_method: string
          p_date: string
          p_rep: string | null
          p_reference: string | null
          p_notes: string | null
          p_currency?: string
          p_rate?: number
          p_allocations?: Json
        }
        Returns: string
      }
      settle_rep_custody: {
        Args: {
          p_rep: string
          p_payment_ids: string[]
          p_date: string
          p_notes: string | null
        }
        Returns: string
      }
      record_stock_transfer: {
        Args: {
          p_from: string
          p_notes?: string
          p_product: string
          p_qty: number
          p_to: string
        }
        Returns: undefined
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
