from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import requests
import os
from pymongo import MongoClient
import uuid
from datetime import datetime, timedelta
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URL)
db = client.stock_dashboard
watchlist_collection = db.watchlist

# Alpha Vantage API key
ALPHA_VANTAGE_API_KEY = os.environ.get('ALPHA_VANTAGE_API_KEY', 'ZL7EOROXMXPKV7YX')
ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"

# Models
class StockTicker(BaseModel):
    symbol: str
    name: str = ""

class WatchlistItem(BaseModel):
    id: str
    symbol: str
    name: str
    added_date: str

# Thread pool for async API calls
executor = ThreadPoolExecutor(max_workers=5)

def make_alpha_vantage_request(params):
    """Make a request to Alpha Vantage API"""
    try:
        response = requests.get(ALPHA_VANTAGE_BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if "Error Message" in data:
            raise HTTPException(status_code=400, detail=f"Invalid symbol: {data['Error Message']}")
        if "Note" in data:
            raise HTTPException(status_code=429, detail="API rate limit exceeded. Please try again later.")
            
        return data
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"API request failed: {str(e)}")

@app.get("/api/")
async def root():
    return {"message": "Stock Dashboard API is running!"}

@app.get("/api/search/{query}")
async def search_stocks(query: str):
    """Search for stock symbols"""
    try:
        params = {
            'function': 'SYMBOL_SEARCH',
            'keywords': query,
            'apikey': ALPHA_VANTAGE_API_KEY
        }
        
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(executor, make_alpha_vantage_request, params)
        
        if 'bestMatches' not in data:
            return {"results": []}
            
        results = []
        for match in data['bestMatches'][:10]:  # Limit to top 10 results
            results.append({
                "symbol": match.get('1. symbol', ''),
                "name": match.get('2. name', ''),
                "type": match.get('3. type', ''),
                "region": match.get('4. region', ''),
                "currency": match.get('8. currency', '')
            })
        
        return {"results": results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/watchlist")
async def add_to_watchlist(ticker: StockTicker):
    """Add a stock to watchlist"""
    try:
        # Check if already exists
        existing = watchlist_collection.find_one({"symbol": ticker.symbol.upper()})
        if existing:
            raise HTTPException(status_code=400, detail="Stock already in watchlist")
        
        # Add to watchlist
        watchlist_item = {
            "id": str(uuid.uuid4()),
            "symbol": ticker.symbol.upper(),
            "name": ticker.name,
            "added_date": datetime.now().isoformat()
        }
        
        watchlist_collection.insert_one(watchlist_item)
        return {"message": "Stock added to watchlist", "item": watchlist_item}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/watchlist/{symbol}")
async def remove_from_watchlist(symbol: str):
    """Remove a stock from watchlist"""
    try:
        result = watchlist_collection.delete_one({"symbol": symbol.upper()})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Stock not found in watchlist")
        
        return {"message": "Stock removed from watchlist"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/watchlist")
async def get_watchlist():
    """Get user's watchlist"""
    try:
        watchlist = list(watchlist_collection.find({}, {"_id": 0}))
        return {"watchlist": watchlist}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quote/{symbol}")
async def get_stock_quote(symbol: str):
    """Get real-time stock quote"""
    try:
        params = {
            'function': 'GLOBAL_QUOTE',
            'symbol': symbol.upper(),
            'apikey': ALPHA_VANTAGE_API_KEY
        }
        
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(executor, make_alpha_vantage_request, params)
        
        if 'Global Quote' not in data:
            raise HTTPException(status_code=404, detail="Stock quote not found")
        
        quote = data['Global Quote']
        
        # Parse the quote data
        result = {
            "symbol": quote.get('01. symbol', symbol.upper()),
            "price": float(quote.get('05. price', 0)),
            "change": float(quote.get('09. change', 0)),
            "change_percent": quote.get('10. change percent', '0%').replace('%', ''),
            "volume": int(quote.get('06. volume', 0)),
            "latest_trading_day": quote.get('07. latest trading day', ''),
            "previous_close": float(quote.get('08. previous close', 0)),
            "open": float(quote.get('02. open', 0)),
            "high": float(quote.get('03. high', 0)),
            "low": float(quote.get('04. low', 0))
        }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/historical/{symbol}")
async def get_historical_data(symbol: str, period: str = "1M"):
    """Get historical stock data"""
    try:
        # Determine the function based on period
        if period in ["1D", "1W"]:
            function = "TIME_SERIES_INTRADAY"
            interval = "60min"
        elif period in ["1M", "3M"]:
            function = "TIME_SERIES_DAILY"
        else:  # 6M, 1Y, 5Y
            function = "TIME_SERIES_WEEKLY"
        
        params = {
            'function': function,
            'symbol': symbol.upper(),
            'apikey': ALPHA_VANTAGE_API_KEY
        }
        
        if function == "TIME_SERIES_INTRADAY":
            params['interval'] = interval
            params['outputsize'] = 'full'
        elif function == "TIME_SERIES_DAILY":
            params['outputsize'] = 'full'
        
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(executor, make_alpha_vantage_request, params)
        
        # Extract time series data
        time_series_key = None
        for key in data.keys():
            if 'Time Series' in key:
                time_series_key = key
                break
        
        if not time_series_key:
            raise HTTPException(status_code=404, detail="Historical data not found")
        
        time_series = data[time_series_key]
        
        # Convert to array format for charting
        historical_data = []
        for date_str, values in time_series.items():
            try:
                date_obj = datetime.strptime(date_str.split()[0], '%Y-%m-%d')
                
                # Filter data based on period
                now = datetime.now()
                if period == "1D" and (now - date_obj).days > 1:
                    continue
                elif period == "1W" and (now - date_obj).days > 7:
                    continue
                elif period == "1M" and (now - date_obj).days > 30:
                    continue
                elif period == "3M" and (now - date_obj).days > 90:
                    continue
                elif period == "6M" and (now - date_obj).days > 180:
                    continue
                elif period == "1Y" and (now - date_obj).days > 365:
                    continue
                elif period == "5Y" and (now - date_obj).days > 1825:
                    continue
                
                historical_data.append({
                    "date": date_str,
                    "open": float(values.get('1. open', 0)),
                    "high": float(values.get('2. high', 0)),
                    "low": float(values.get('3. low', 0)),
                    "close": float(values.get('4. close', 0)),
                    "volume": int(values.get('5. volume', 0))
                })
            except (ValueError, KeyError):
                continue
        
        # Sort by date (oldest first)
        historical_data.sort(key=lambda x: x['date'])
        
        return {
            "symbol": symbol.upper(),
            "period": period,
            "data": historical_data[-200:]  # Limit to last 200 data points for performance
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/comparison")
async def get_comparison_data(symbols: str, period: str = "1M"):
    """Get historical data for multiple symbols for comparison"""
    try:
        symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()]
        
        if len(symbol_list) > 5:
            raise HTTPException(status_code=400, detail="Maximum 5 symbols allowed for comparison")
        
        comparison_data = {}
        
        for symbol in symbol_list:
            try:
                # Reuse the historical data endpoint logic
                historical_response = await get_historical_data(symbol, period)
                comparison_data[symbol] = historical_response['data']
            except Exception as e:
                print(f"Error fetching data for {symbol}: {e}")
                comparison_data[symbol] = []
        
        return {
            "symbols": symbol_list,
            "period": period,
            "data": comparison_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)