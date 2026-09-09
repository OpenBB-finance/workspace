while IFS= read -r line; do
  [[ $line =~ ^[^#].+=.+ ]] && export "$line"
done < .env