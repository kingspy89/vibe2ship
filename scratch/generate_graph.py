import pandas as pd
import matplotlib.pyplot as plt
import os

def generate_plots():
    csv_path = "civic_issues_ml_dataset.csv"
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return

    print("Reading dataset...")
    df = pd.read_csv(csv_path)

    # Set dark theme styling to match the CivicPulse UI
    plt.style.use('dark_background')
    fig, axes = plt.subplots(1, 2, figsize=(16, 6))

    # Color palette
    colors = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#eab308']

    # 1. Distribution of Priority Scores
    ax1 = axes[0]
    n, bins, patches = ax1.hist(df['priority_score'], bins=20, color='#6366f1', edgecolor='#12131a', alpha=0.85)
    
    # Add gradient feel to the histogram bars
    for i, patch in enumerate(patches):
        alpha_val = 0.5 + 0.5 * (i / len(patches))
        patch.set_alpha(alpha_val)
        patch.set_facecolor('#6366f1')

    ax1.set_title('Civic Issue Priority Score Distribution', fontsize=14, fontweight='bold', pad=15, color='#ffffff')
    ax1.set_xlabel('Priority Score (1.0 - 10.0)', fontsize=12, labelpad=10)
    ax1.set_ylabel('Number of Issues', fontsize=12, labelpad=10)
    ax1.grid(color='#262626', linestyle='--', linewidth=0.5)
    ax1.spines['top'].set_visible(False)
    ax1.spines['right'].set_visible(False)
    ax1.spines['left'].set_color('#404040')
    ax1.spines['bottom'].set_color('#404040')

    # 2. Average Priority by Category
    ax2 = axes[1]
    avg_priority = df.groupby('category')['priority_score'].mean().sort_values(ascending=False)
    bars = ax2.bar(avg_priority.index, avg_priority.values, color=colors[:len(avg_priority)], alpha=0.85, width=0.6)
    
    for bar in bars:
        yval = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width()/2.0, yval + 0.15, f"{yval:.2f}", ha='center', va='bottom', fontsize=10, color='#e5e5e5', fontweight='semibold')

    ax2.set_title('Average Priority Score by Issue Category', fontsize=14, fontweight='bold', pad=15, color='#ffffff')
    ax2.set_xlabel('Issue Category', fontsize=12, labelpad=10)
    ax2.set_ylabel('Mean Priority Score', fontsize=12, labelpad=10)
    ax2.set_ylim(0, 10)
    ax2.grid(color='#262626', linestyle='--', linewidth=0.5, axis='y')
    ax2.spines['top'].set_visible(False)
    ax2.spines['right'].set_visible(False)
    ax2.spines['left'].set_color('#404040')
    ax2.spines['bottom'].set_color('#404040')

    plt.tight_layout()

    # Create assets directory if not exists
    os.makedirs("assets", exist_ok=True)
    output_img = "assets/priority_score_distribution.png"
    plt.savefig(output_img, dpi=300, facecolor='#12131a')
    print(f"SUCCESS! Graph saved to {output_img}")

if __name__ == "__main__":
    generate_plots()
