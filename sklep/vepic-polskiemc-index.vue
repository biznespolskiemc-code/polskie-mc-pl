<template>
  <div class="shop-page">
    <div class="shop-page-background"></div>

    <main class="shop-content">
      <section v-if="announcements.length" class="shop-announcements">
        <div
          v-for="announcement in announcements"
          :key="announcement.id"
          class="shop-announcement"
          v-html="announcement.content"
        ></div>
      </section>

      <section class="products-card">
        <div class="shop-breadcrumbs">
          <nuxt-link to="/">Sklep</nuxt-link>
          <span class="breadcrumb-divider">/</span>
          <span class="breadcrumb-current">{{ selectedServerName }}</span>
        </div>

        <div v-if="showCategories" class="product-categories">
          <button
            type="button"
            class="product-category-chip"
            :class="{ 'is-active': selectedCategory === null }"
            :aria-pressed="selectedCategory === null"
            @click="selectCategory(null)"
          >
            Wszystkie
          </button>
          <button
            v-for="category in visibleCategories"
            :key="category.id"
            type="button"
            class="product-category-chip"
            :class="{ 'is-active': selectedCategory === category.id }"
            :aria-pressed="selectedCategory === category.id"
            @click="selectCategory(category.id)"
          >
            {{ category.name }}
          </button>
        </div>

        <div v-if="loading" class="shop-message">Ładowanie produktów...</div>
        <div v-else-if="filteredProducts.length" class="product-grid">
          <article
            v-for="product in filteredProducts"
            :key="product.id"
            class="product-select-card"
          >
            <div class="product-image-area">
              <img
                v-if="product.image"
                :src="product.image"
                :alt="product.name"
                class="product-image"
                loading="lazy"
              >
              <div v-else class="product-image product-image-placeholder"></div>
            </div>

            <div class="product-name-card">{{ product.name }}</div>

            <div class="product-price-card">
              <span v-if="product.promo" class="product-old-price">
                {{ formatPrice(product.main_price) }} zł
              </span>
              <span class="product-current-price">
                {{ getFinalPrice(product) }} zł
              </span>
            </div>

            <div class="product-card-actions">
              <button
                type="button"
                class="buy-product-button"
                @click="buyProduct(product.id)"
              >
                Zakup
              </button>
            </div>
          </article>
        </div>
        <div v-else class="shop-message">
          Brak produktów w tej kategorii.
        </div>
      </section>
    </main>
  </div>
</template>

<script>
export default {
  name: 'ShopIndex',
  data () {
    return {
      products: [],
      announcements: [],
      selectedServer: null,
      selectedCategory: null,
      loading: true
    }
  },
  async created () {
    const servers = Array.isArray(this.$store.state.servers)
      ? this.$store.state.servers
      : []
    const preferredServerId = Number(this.$config.default_server_id)
    const preferredServer = servers.find(server => Number(server.id) === preferredServerId)
    const server = preferredServer || servers[0]

    if (server) {
      this.selectedServer = server.id
      await this.loadProducts()
    } else {
      this.loading = false
    }

    await this.loadAnnouncements()
  },
  computed: {
    visibleCategories () {
      const categories = (this.$store.state.shop && this.$store.state.shop.categories) || []
      return categories.filter(category =>
        this.products.some(product => Number(product.category) === Number(category.id))
      )
    },
    showCategories () {
      return this.visibleCategories.length > 0
    },
    filteredProducts () {
      if (this.selectedCategory === null) {
        return this.products
      }
      return this.products.filter(product => Number(product.category) === Number(this.selectedCategory))
    },
    selectedServerName () {
      const servers = Array.isArray(this.$store.state.servers)
        ? this.$store.state.servers
        : []
      const selected = servers.find(server => Number(server.id) === Number(this.selectedServer))
      return selected ? selected.name : 'Earth SMP'
    }
  },
  methods: {
    selectCategory (categoryId) {
      this.selectedCategory = categoryId
    },
    formatPrice (price) {
      const value = Number.parseFloat(price)
      return Number.isFinite(value) ? value.toFixed(2) : price
    },
    getFinalPrice (product) {
      const value = product.promo
        ? this.$price.calcPrice(product.main_price, product.promo)
        : product.main_price
      return this.formatPrice(value)
    },
    async loadProducts () {
      if (!this.selectedServer) {
        this.products = []
        this.loading = false
        return
      }

      this.loading = true
      try {
        const response = await fetch(`https://dev123.vishop.pl/panel/shops/${this.$config.shop_id}/products/?server=${this.selectedServer}`)
        if (!response.ok) {
          throw new Error(`ViShop API returned ${response.status}`)
        }
        const data = await response.json()
        this.products = Array.isArray(data) ? data : []
      } catch (error) {
        console.error('Nie udało się pobrać produktów ViShop:', error)
        this.products = []
      } finally {
        this.loading = false
      }
    },
    async loadAnnouncements () {
      try {
        const response = await fetch(`https://dev123.vishop.pl/panel/shops/${this.$config.shop_id}/announcements/`)
        if (!response.ok) {
          throw new Error(`ViShop API returned ${response.status}`)
        }
        const data = await response.json()
        this.announcements = Array.isArray(data) ? data : []
      } catch (error) {
        console.error('Nie udało się pobrać ogłoszeń ViShop:', error)
        this.announcements = []
      }
    },
    buyProduct (productId) {
      if (typeof vishopPay !== 'function') {
        this.$toast.error('Nie udało się uruchomić płatności. Odśwież stronę.')
        return
      }
      vishopPay(this.$store.state.shop.id, productId)
    }
  }
}
</script>

<style>
.shop-page {
  position: relative;
  min-height: 520px;
  color: #fff;
}

.shop-page-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    linear-gradient(rgba(0, 0, 0, .45), rgba(0, 0, 0, .58)),
    url('https://imgur.com/Lu0JKDN.png') center center / cover no-repeat;
  background-attachment: fixed;
}

.shop-content {
  position: relative;
  z-index: 1;
  width: 100%;
  margin: 0 auto 48px;
  padding-top: 20px;
}

.products-card {
  width: 100%;
  padding: 10px;
  background: #141419;
  border: 2px solid rgba(255, 255, 255, .14);
  border-radius: 16px;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, .45);
}

.shop-breadcrumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  min-height: 42px;
  padding: 0 10px;
  color: #fff;
  font-size: 14px;
}

.shop-breadcrumbs a {
  color: #fff;
  text-decoration: none;
}

.shop-breadcrumbs a:hover {
  color: #d61841;
}

.breadcrumb-divider {
  color: rgba(255, 255, 255, .5);
}

.breadcrumb-current {
  color: rgba(255, 255, 255, .65);
}

.product-categories {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 8px 16px;
}

.product-category-chip {
  min-height: 34px;
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s, color .2s;
}

.product-category-chip:hover {
  background: rgba(255, 255, 255, .06);
}

.product-category-chip.is-active {
  background: rgba(214, 24, 65, .12);
  color: #d61841;
}

/* Tak jak w poprzednim sklepie: przycisk „Wszystkie” nie zajmuje miejsca. */
.product-category-chip:first-child {
  display: none;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  padding: 0 2px 8px;
}

.product-select-card {
  display: flex;
  min-width: 0;
  min-height: 350px;
  flex-direction: column;
  align-items: stretch;
  overflow: hidden;
  background: #141419;
  border: 2px solid rgba(255, 255, 255, .14);
  border-radius: 16px;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, .45);
  transition: border-color .2s, box-shadow .2s;
}

.product-select-card:hover {
  border-color: rgba(255, 255, 255, .14);
  box-shadow: 6px 6px 0 rgba(0, 0, 0, .45);
}

.product-image-area {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 218px;
  padding: 10px 8px 4px;
}

.product-image {
  display: block;
  width: 200px;
  height: 200px;
  max-width: 100%;
  object-fit: cover;
  border-radius: 10px;
}

.product-image-placeholder {
  background: rgba(255, 255, 255, .035);
  border: 1px solid rgba(255, 255, 255, .08);
}

.product-name-card {
  padding: 8px 10px 4px;
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.35;
  text-align: center;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

.product-price-card {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 12px;
  color: #fff;
  font-size: 14px;
  text-align: center;
}

.product-old-price {
  color: #999;
  text-decoration: line-through;
}

.product-current-price {
  color: #fff;
}

.product-card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding: 0 12px 12px;
}

.buy-product-button {
  display: inline-flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 9px 16px;
  border: 2px solid rgba(255, 255, 255, .18);
  border-radius: 10px;
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 4px 4px 0 rgba(0, 0, 0, .45);
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  transition: transform .2s, box-shadow .2s;
}

.buy-product-button:hover {
  transform: translateY(-2px);
  box-shadow: 6px 6px 0 rgba(0, 0, 0, .5);
}

.shop-message {
  padding: 35px 12px;
  color: rgba(255, 255, 255, .7);
  text-align: center;
}

.shop-announcements {
  display: grid;
  gap: 10px;
  margin: 18px 0;
}

.shop-announcement {
  padding: 16px 20px;
  border: 2px solid rgba(255, 255, 255, .14);
  border-radius: 12px;
  background: #141419;
  color: #fff;
}

.shop-announcement a {
  color: #d61841;
}

@media (max-width: 960px) {
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .products-card {
    padding: 7px;
    border-radius: 12px;
  }

  .product-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .product-select-card {
    min-height: 330px;
  }

  .product-image-area {
    min-height: 205px;
  }

  .product-image {
    width: 185px;
    height: 185px;
  }
}
</style>
