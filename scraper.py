import requests
import json
import os
from datetime import datetime

# Rutas de los archivos JSON
DATA_DIR = 'data'
PRODUCTS_FILE = os.path.join(DATA_DIR, 'products.json')
HISTORY_FILE = os.path.join(DATA_DIR, 'history.json')

def load_json(filepath):
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_json(data, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def fetch_categories():
    url = 'https://tienda.mercadona.es/api/categories/'
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json().get('results', [])
    except Exception as e:
        print(f"Error fetching categories: {e}")
        return []

def fetch_category_details(category_id):
    url = f'https://tienda.mercadona.es/api/categories/{category_id}/'
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json().get('categories', [])
    except Exception as e:
        print(f"Error fetching category {category_id}: {e}")
        return []

def main():
    print(f"[{datetime.now()}] Iniciando recolección de datos...")
    
    products_db = load_json(PRODUCTS_FILE)
    history_db = load_json(HISTORY_FILE)
    
    today_date = datetime.now().strftime('%Y-%m-%d')
    
    categories = fetch_categories()
    
    for category in categories:
        cat_id = category['id']
        cat_name = category['name']
        print(f"Procesando categoría: {cat_name}")
        
        for subcat in category.get('categories', []):
            subcat_id = subcat['id']
            subcat_name = subcat['name']
            
            detailed_cats = fetch_category_details(subcat_id)
            
            for cat_info in detailed_cats:
                for producto in cat_info.get('products', []):
                    prod_id = str(producto['id'])
                    precios = producto.get('price_instructions', {})
                    
                    if not precios:
                        continue
                        
                    unit_price = float(precios.get('unit_price', 0))
                    bulk_price = float(precios.get('bulk_price', 0)) # Precio por kilo/litro
                    
                    if bulk_price == 0:
                        bulk_price = unit_price # Fallback
                    
                    # Guardar/Actualizar info del producto
                    products_db[prod_id] = {
                        'id': prod_id,
                        'name': producto['display_name'],
                        'thumbnail': producto.get('thumbnail', ''),
                        'category': cat_name,
                        'subcategory': subcat_name,
                        'unit_size': precios.get('unit_size', ''),
                        'size_format': precios.get('size_format', ''),
                        'current_price': unit_price,
                        'bulk_price': bulk_price,
                        'last_updated': today_date
                    }
                    
                    # Actualizar historial
                    if prod_id not in history_db:
                        history_db[prod_id] = []
                        
                    # Evitar duplicados el mismo día
                    if not any(entry['date'] == today_date for entry in history_db[prod_id]):
                        history_db[prod_id].append({
                            'date': today_date,
                            'price': unit_price,
                            'bulk_price': bulk_price
                        })

    # Guardar bases de datos
    save_json(products_db, PRODUCTS_FILE)
    save_json(history_db, HISTORY_FILE)
    print(f"[{datetime.now()}] Recolección finalizada. Datos guardados en '{DATA_DIR}/'")

if __name__ == "__main__":
    main()
