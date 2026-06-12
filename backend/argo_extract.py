import urllib.request
import xarray as xr
import pandas as pd
import os

# Downloading a sample argo float data file
DATA_URL = 'https://data-argo.ifremer.fr/dac/incois/2903954/2903954_prof.nc'
LOCAL_FILE = 'sample_argo.nc'

print(f"Downloading from {DATA_URL}...")
try:
    # Adding a User-Agent header to prevent the server from blocking the script
    req = urllib.request.Request(DATA_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(LOCAL_FILE, 'wb') as out_file:
        out_file.write(response.read())
    print("Download complete.")

except Exception as e:
    print(f"FTP download failed: {e}")
    exit()

#open and parse the netcdf file using xarray
print("\n Opening the File ...")
try:
    ds = xr.open_dataset(LOCAL_FILE)

    lat= ds['LATITUDE'].values[0]
    lon = ds['LONGITUDE'].values[0]
    timestamp = ds['JULD'].values[0]

    print(f"\n--- FLoat info ---")
    print(f"Date: {timestamp}")
    print(f"location : Lat {lat:.4f}, Lon {lon:.4f}")

    pressure = ds['PRES'].values[0]
    temperature = ds['TEMP'].values[0]
    salinity = ds['PSAL'].values[0]

    df= pd.DataFrame({
        'Pressure (dbar)':pressure,
        'Temperature (°C)' :temperature,
        'Salinity (PSU)' : salinity
    })

    df=df.dropna()

    print("\n---First 10 readings (Descending Depth) ---")
    print(df.head(10))

    print("\nData extraction successful, Ready for database ingestion.")
except Exception as e:
    print(f"Error parsing file : {e}")