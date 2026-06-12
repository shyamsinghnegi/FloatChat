import xarray as xr
import pandas as pd

# 1. Open the file
LOCAL_FILE = 'sample_argo.nc'
ds = xr.open_dataset(LOCAL_FILE)

print(f"Extracting profile data from {LOCAL_FILE}...\n")

# 2. Extract the platform numbers (Float IDs are stored as byte strings, so we decode them)
try:
    float_ids = [fid.decode('utf-8').strip() for fid in ds['PLATFORM_NUMBER'].values]
except AttributeError:
    float_ids = ds['PLATFORM_NUMBER'].values

# 3. Build a DataFrame of ONLY the profile metadata
df_profiles = pd.DataFrame({
    'Profile_Index': range(ds.dims['N_PROF']), # The internal index (0, 1, 2...)
    'Float_ID': float_ids,
    'Cycle_Number': ds['CYCLE_NUMBER'].values, # The actual dive number of this float
    'Time': ds['JULD'].values,
    'Latitude': ds['LATITUDE'].values,
    'Longitude': ds['LONGITUDE'].values
})

# 4. Print the results
print(f"Total Profiles (Dives) found: {len(df_profiles)}")
print("-" * 50)

# Print the first 20 profiles to keep your terminal clean
print(df_profiles)