import requests
import sys
import time
from datetime import datetime

class StockDashboardTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_stock_symbols = ["AAPL", "GOOGL", "TSLA", "MSFT"]
        self.test_periods = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"]

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json().get('detail', 'No detail provided')
                    print(f"Error detail: {error_detail}")
                except:
                    print("Could not parse error response")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test the API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "api/",
            200
        )
        if success:
            print(f"API Response: {response}")
        return success

    def test_stock_search(self, query="AAPL"):
        """Test stock search endpoint"""
        success, response = self.run_test(
            f"Stock Search for '{query}'",
            "GET",
            f"api/search/{query}",
            200
        )
        if success:
            results = response.get('results', [])
            print(f"Found {len(results)} results for '{query}'")
            if len(results) > 0:
                print(f"First result: {results[0]}")
        return success, response

    def test_watchlist_operations(self, stock_symbol="AAPL", stock_name="Apple Inc."):
        """Test watchlist add, get, and delete operations"""
        # First, add to watchlist
        success_add, response_add = self.run_test(
            f"Add {stock_symbol} to Watchlist",
            "POST",
            "api/watchlist",
            200,
            data={"symbol": stock_symbol, "name": stock_name}
        )
        
        if not success_add:
            return False
        
        # Get watchlist
        success_get, response_get = self.run_test(
            "Get Watchlist",
            "GET",
            "api/watchlist",
            200
        )
        
        if not success_get:
            return False
        
        watchlist = response_get.get('watchlist', [])
        print(f"Watchlist contains {len(watchlist)} items")
        
        # Check if our stock is in the watchlist
        found = False
        for item in watchlist:
            if item.get('symbol') == stock_symbol:
                found = True
                break
        
        if found:
            print(f"✅ {stock_symbol} found in watchlist")
        else:
            print(f"❌ {stock_symbol} not found in watchlist")
            return False
        
        # Delete from watchlist
        success_delete, _ = self.run_test(
            f"Remove {stock_symbol} from Watchlist",
            "DELETE",
            f"api/watchlist/{stock_symbol}",
            200
        )
        
        return success_add and success_get and success_delete

    def test_stock_quote(self, symbol="AAPL"):
        """Test stock quote endpoint"""
        success, response = self.run_test(
            f"Get Quote for {symbol}",
            "GET",
            f"api/quote/{symbol}",
            200
        )
        
        if success:
            print(f"Quote for {symbol}:")
            print(f"  Price: ${response.get('price', 'N/A')}")
            print(f"  Change: {response.get('change', 'N/A')} ({response.get('change_percent', 'N/A')}%)")
            print(f"  Volume: {response.get('volume', 'N/A')}")
        
        return success

    def test_historical_data(self, symbol="AAPL", period="1M"):
        """Test historical data endpoint"""
        success, response = self.run_test(
            f"Get Historical Data for {symbol} ({period})",
            "GET",
            f"api/historical/{symbol}",
            200,
            params={"period": period}
        )
        
        if success:
            data_points = response.get('data', [])
            print(f"Retrieved {len(data_points)} historical data points for {symbol} ({period})")
            if len(data_points) > 0:
                print(f"First data point: {data_points[0]}")
                print(f"Last data point: {data_points[-1]}")
        
        return success

    def test_comparison_data(self, symbols=["AAPL", "MSFT"], period="1M"):
        """Test comparison data endpoint"""
        symbols_str = ",".join(symbols)
        success, response = self.run_test(
            f"Get Comparison Data for {symbols_str} ({period})",
            "GET",
            "api/comparison",
            200,
            params={"symbols": symbols_str, "period": period}
        )
        
        if success:
            data = response.get('data', {})
            print(f"Retrieved comparison data for {len(data)} symbols")
            for symbol, points in data.items():
                print(f"  {symbol}: {len(points)} data points")
        
        return success

    def run_all_tests(self):
        """Run all tests"""
        print("=" * 80)
        print("STOCK DASHBOARD API TEST SUITE")
        print("=" * 80)
        
        # Test API root
        api_root_success = self.test_api_root()
        if not api_root_success:
            print("❌ API root test failed. Stopping tests.")
            return False
        
        # Test stock search
        search_success, search_response = self.test_stock_search("AAPL")
        if not search_success:
            print("❌ Stock search test failed. Stopping tests.")
            return False
        
        # Get a stock from search results for further testing
        test_stock = None
        if search_response and 'results' in search_response and len(search_response['results']) > 0:
            test_stock = search_response['results'][0]
            print(f"Using {test_stock['symbol']} for further tests")
        else:
            test_stock = {"symbol": "AAPL", "name": "Apple Inc."}
            print(f"Using default stock {test_stock['symbol']} for further tests")
        
        # Test watchlist operations
        watchlist_success = self.test_watchlist_operations(test_stock['symbol'], test_stock['name'])
        if not watchlist_success:
            print("❌ Watchlist operations test failed.")
        
        # Test stock quote
        quote_success = self.test_stock_quote(test_stock['symbol'])
        if not quote_success:
            print(f"❌ Stock quote test for {test_stock['symbol']} failed.")
        
        # Test historical data with different periods
        historical_success = True
        for period in self.test_periods:
            period_success = self.test_historical_data(test_stock['symbol'], period)
            if not period_success:
                print(f"❌ Historical data test for {test_stock['symbol']} ({period}) failed.")
                historical_success = False
            # Add a small delay to avoid rate limiting
            time.sleep(1)
        
        # Test comparison data
        comparison_success = self.test_comparison_data([test_stock['symbol'], "MSFT"])
        if not comparison_success:
            print("❌ Comparison data test failed.")
        
        # Print test summary
        print("\n" + "=" * 80)
        print(f"TEST SUMMARY: {self.tests_passed}/{self.tests_run} tests passed")
        print("=" * 80)
        
        return self.tests_passed == self.tests_run

def main():
    # Get the backend URL from frontend/.env
    backend_url = "https://1f37b3b9-e1d7-4bf5-982d-86695889c8cf.preview.emergentagent.com"
    
    print(f"Using backend URL: {backend_url}")
    
    # Create tester instance
    tester = StockDashboardTester(backend_url)
    
    # Run all tests
    success = tester.run_all_tests()
    
    # Return exit code
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())