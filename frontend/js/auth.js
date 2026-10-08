// Đăng nhập / Đăng ký

// Trang cần quay lại sau khi đăng nhập (chỉ nhận trang nội bộ để tránh bị chuyển hướng ra ngoài)
function nextPage() {
  const next = new URLSearchParams(location.search).get("next") || "";
  return /^[a-z-]+\.html([?#][^\s]*)?$/i.test(next) && !/^(login|register)\.html/i.test(next) ? next : "trips.html";
}

async function submitAuth(form, path, payload) {
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    const data = await api(path, { method: "POST", body: payload });
    Auth.save(data);
    window.location.href = nextPage();
  } catch (err) {
    if (err.handled) return;
    const fields = err.fields || {};
    const key = Object.keys(fields)[0];
    if (path.endsWith("register") && /đã được đăng ký/.test(err.message)) {
      const goLogin = await Dialog.show({
        kind: "error",
        title: "Email này đã có tài khoản",
        message: "Có vẻ bạn đã đăng ký bằng email này rồi. Đăng nhập luôn nhé?",
        primary: "Đăng nhập",
        secondary: "Dùng email khác"
      });
      if (goLogin) window.location.href = "login.html" + location.search;
      else FieldError.set(form.email, "Email này đã được đăng ký"), form.email.focus();
    } else if (path.endsWith("login") && !key) {
      await FieldError.fail(form.password, "Sai email hoặc mật khẩu", "Kiểm tra lại email, mật khẩu và phím Caps Lock rồi thử lại nhé.", "Thử lại");
    } else {
      await FieldError.fail(key ? form[key] : null, "Thông tin chưa đúng", err.message);
    }
  } finally {
    btn.disabled = false;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

document.addEventListener("DOMContentLoaded", () => {
  if (Auth.isLoggedIn()) {
    window.location.replace(nextPage());
    return;
  }
  // Giữ trang cần quay lại khi chuyển qua lại giữa đăng nhập và đăng ký
  const sw = document.getElementById("switchLink");
  if (location.search) sw.href += location.search;

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      FieldError.clearAll(loginForm);
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;
      if (!email) return FieldError.fail(loginForm.email, "Bạn chưa nhập email", "Nhập email bạn đã dùng để đăng ký nhé.");
      if (!password) return FieldError.fail(loginForm.password, "Bạn chưa nhập mật khẩu", "Nhập mật khẩu để đăng nhập nhé.");
      submitAuth(loginForm, "/auth/login", { email, password });
    });
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      FieldError.clearAll(registerForm);
      const f = registerForm;
      const fullName = f.fullName.value.trim();
      const email = f.email.value.trim();
      const password = f.password.value;
      if (!fullName) return FieldError.fail(f.fullName, "Bạn chưa nhập họ tên", "Cho mình biết tên bạn để hiển thị trên tài khoản nhé. Tối đa 100 ký tự.");
      if (!EMAIL_RE.test(email)) return FieldError.fail(f.email, "Email chưa đúng", "Email phải có dạng ten@vidu.com và không quá 150 ký tự.");
      if (password.length < 6) return FieldError.fail(f.password, "Mật khẩu quá ngắn", "Mật khẩu cần ít nhất 6 ký tự để an toàn hơn.");
      if (password !== f.confirmPassword.value) return FieldError.fail(f.confirmPassword, "Mật khẩu nhập lại không khớp", "Hai ô mật khẩu đang khác nhau. Bạn nhập lại giúp mình nhé.");
      submitAuth(f, "/auth/register", { fullName, email, password });
    });
  }
});
