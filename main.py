import requests

def ablancodev_get_categories():
    url = 'https://tienda.mercadona.es/api/categories/'
    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()

        if 'results' in data:
            for category in data['results']:
                # if category['id'] == 12:
                print('ID:', category['id'], category['name'])

                categorias = category['categories']
                for alimento in categorias:
                    # if alimento['id'] == 117:
                    print('\tID:', alimento['id'], alimento['name'])

                    ablancodev_get_category(alimento['id'])


def ablancodev_get_category(category_id):
    url = f'https://tienda.mercadona.es/api/categories/{category_id}/'
    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()

        # print(data)

        if 'categories' in data:
            for cat_info in data['categories']:

                productos = cat_info['products']
                
                print(f'\t\tID {cat_info["id"]}: {cat_info["name"]}')

                for producto in productos:
                    # if cat_info['id'] == 435:
                    precios = producto['price_instructions']

                    print('\t\t\tID:', producto['id'], producto['display_name'])
                    # if precios['unit_name']:
                    #     print(f'\t\t\t\tEnvasado: {producto["packaging"]} ({precios["total_units"]} {precios["unit_name"]})')
                    # else:
                    #     print(f'\t\t\t\tEnvasado: {producto["packaging"]}')
                    
                    # print('\t\t\t\tIVA:', round(float(precios['tax_percentage']),2), '%')
                    print('\t\t\t\tCantidad:', precios['unit_size'], precios['size_format'])
                    print('\t\t\t\tPrecio:', precios['unit_price'], '€')


if __name__ == "__main__":
    ablancodev_get_categories()
