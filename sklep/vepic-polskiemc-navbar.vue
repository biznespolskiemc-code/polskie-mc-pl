<template>
  <div class="navbar-with-logo">
    <div class="brand-row">
      <img src="https://imgur.com/5y1eMdb.png" alt="POLSKIEMC.PL" class="brand-logo">
      <h1 class="shop-navbar-name"><span>POLSKIEMC.PL</span><small> | Sklep</small></h1>
    </div>

    <header class="shop-navbar">
      <button
        type="button"
        class="mobile-menu-button"
        aria-label="Otwórz menu"
        :aria-expanded="showMenu ? 'true' : 'false'"
        @click="toggleNavbar"
      >
        <span></span><span></span><span></span>
      </button>

      <nav class="shop-nav-links" :class="{ 'mobile-open': showMenu }">
        <nuxt-link to="/" class="shop-nav-link" @click.native="showMenu = false">sklep</nuxt-link>
        <a href="https://polskiemc.pl" target="_blank" rel="nofollow noopener" class="shop-nav-link">powrót</a>
        <nuxt-link to="/subpage/8749" class="shop-nav-link" @click.native="showMenu = false">REGULAMIN SKLEPU</nuxt-link>
      </nav>

      <div class="nav-spacer"></div>
      <nuxt-link to="/voucher" class="shop-nav-link voucher-link" @click.native="showMenu = false">Voucher</nuxt-link>
    </header>
  </div>
</template>

<script>
export default {
  name: 'Navbar',
  data () {
    return {
      showMenu: false
    }
  },
  methods: {
    toggleNavbar () {
      this.showMenu = !this.showMenu
    }
  }
}
</script>

<style>
.navbar-with-logo {
  width: 100%;
  margin: 22px auto 0;
}

.brand-row {
  display: flex;
  min-height: 100px;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.brand-logo {
  display: block;
  width: 100px;
  height: 100px;
  object-fit: contain;
}

.shop-navbar-name {
  margin: 0;
  color: #fff;
  font-size: 36px;
  font-weight: 600;
  line-height: 1.2;
}

.shop-navbar-name span {
  background: linear-gradient(90deg, #d61841 58.3%, #fff 58.3%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.shop-navbar-name small {
  color: #fff;
  font-size: 36px;
  font-weight: 600;
}

.shop-navbar {
  display: flex;
  min-height: 64px;
  align-items: center;
  padding: 0 14px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .15);
  border-radius: 8px;
  background: #0d0d11;
  box-shadow: 5px 5px 0 rgba(0, 0, 0, .45);
}

.shop-nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
}

.shop-nav-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  text-transform: none;
  transition: color .2s;
}

.shop-nav-link:hover,
.shop-nav-link.nuxt-link-exact-active {
  color: #d61841;
}

.nav-spacer {
  flex: 1;
}

.voucher-link {
  white-space: nowrap;
}

.mobile-menu-button {
  display: none;
  width: 42px;
  height: 42px;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 9px;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.mobile-menu-button span {
  display: block;
  width: 22px;
  height: 2px;
  background: #fff;
}

@media (max-width: 700px) {
  .brand-row {
    min-height: 76px;
  }

  .brand-logo {
    width: 72px;
    height: 72px;
  }

  .shop-navbar-name,
  .shop-navbar-name small {
    font-size: 25px;
  }

  .shop-navbar {
    position: relative;
    min-height: 58px;
    flex-wrap: wrap;
    overflow: visible;
  }

  .mobile-menu-button {
    display: flex;
  }

  .shop-nav-links {
    display: none;
    order: 3;
    width: calc(100% + 28px);
    flex-direction: column;
    align-items: stretch;
    margin: 0 -14px;
    padding: 6px 10px 10px;
    border-top: 1px solid rgba(255, 255, 255, .1);
  }

  .shop-nav-links.mobile-open {
    display: flex;
  }

  .shop-nav-link {
    justify-content: flex-start;
  }

  .nav-spacer {
    flex: 1;
  }
}
</style>
