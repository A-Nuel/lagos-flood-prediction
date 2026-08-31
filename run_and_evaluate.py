import pandas as pd
from src.data.make_dataset import run_full_pipeline, build_rainfall_timeseries, build_master_dataset

print("Running pipeline...")
grid = run_full_pipeline()
print("Building rainfall timeseries...")
build_rainfall_timeseries(grid)
print("Building master dataset...")
build_master_dataset(grid)

print("--- EVALUATION ---")
df = pd.read_parquet('data/processed/master_dataset.parquet')
print('Shape:', df.shape)
print()
print('Missing % per column:')
print(df.isna().mean().sort_values(ascending=False).to_string())
print()
print('Label distribution:')
print(df['flood_risk_label'].value_counts())
print()
print('road_density stats:', df['road_density'].describe())
print('drain_density stats:', df['drain_density'].describe())
