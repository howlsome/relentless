<script>
	let { boss = '', parses = [] } = $props();
</script>

<figure aria-label="Parse chart for {boss}">
	<svg viewBox="0 0 400 120" role="img" aria-label="Parse history for {boss}">
		<title>Parse history for {boss}</title>
		<!-- Chart rendered in Stage 4 -->
	</svg>
	<figcaption>{boss}</figcaption>
</figure>
