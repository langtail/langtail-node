import styles from "./chat.module.css";

export function AiLoading() {
  return (
    <div className={styles.loading}>
      <div className={styles.bubble}></div>
      <div className={styles.bubble}></div>
      <div className={styles.bubble}></div>
    </div>
  );
}
