



class MoovitUrl:
    BASE_URL = 'https://moovit.com/'
    BASE_URL_MISS = 'https://moovit.com'
    API_URL = BASE_URL + '/api'
    LOCATION_URL = API_URL + '/location'
    ROUTE_SEARCH_URL = API_URL + '/route/search'
    ROUTE_RESULTS = API_URL + '/route/result'


class MoovitCrawler:
    HEADERS = {'accept': 'application/json, text/plain, */*',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
                'moovit_app_type': 'WEB_TRIP_PLANNER',
                'moovit_client_version': '5.2.0.1/V567',
                'moovit_metro_id': '1',
                'moovit_user_key': 'F27187',
                'referer': 'https://moovit.com/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'} # TODO change the query
    MAX_RESULTS_EXTRACTORS_TRIES = 10